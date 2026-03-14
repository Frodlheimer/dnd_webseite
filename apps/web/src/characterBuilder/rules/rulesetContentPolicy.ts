import type { CharacterRuleset } from '../model/character';
import type { BuilderBackground } from './rulesFacade';

export type RulesetContentPolicy = {
  classesLabel: string;
  racesLabel: string;
  backgroundsLabel: string;
  featsLabel: string;
  spellsLabel: string;
  isBackgroundAllowed: (background: BuilderBackground) => boolean;
};

const commonBackgroundOnly = (background: BuilderBackground) => {
  return background.categories.some((category) => category.toLowerCase() === 'common backgrounds');
};

export const getRulesetContentPolicy = (ruleset: CharacterRuleset): RulesetContentPolicy => {
  if (ruleset === 'DND55_2024') {
    return {
      classesLabel: 'Reserved for the future DnD5.5 guided builder pack.',
      racesLabel: 'Reserved for the future SRD 5.2 species pack.',
      backgroundsLabel: 'Reserved for the future SRD 5.2 origin/background pack.',
      featsLabel: 'Reserved for the future DnD5.5 feat pack.',
      spellsLabel: 'Reserved for the future DnD5.5 spellcasting pack.',
      isBackgroundAllowed: () => false
    };
  }

  return {
    classesLabel: 'Builder-supported 2014 class pack.',
    racesLabel: 'Structured SRD 5.1 races and subraces only.',
    backgroundsLabel: 'Common Backgrounds only.',
    featsLabel: 'Builder-supported feat pack when unlocked by class progression.',
    spellsLabel: 'Class-legal spells from the current local rules data.',
    isBackgroundAllowed: commonBackgroundOnly
  };
};
