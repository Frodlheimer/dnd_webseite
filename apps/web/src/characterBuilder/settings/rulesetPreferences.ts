import {
  DEFAULT_CHARACTER_RULESET,
  normalizeCharacterRuleset,
  type CharacterRuleset
} from '../model/character';

const STORAGE_KEY = 'dnd-vtt:character-builder:default-ruleset';

export const getDefaultCharacterRuleset = (): CharacterRuleset => {
  if (typeof window === 'undefined') {
    return DEFAULT_CHARACTER_RULESET;
  }

  try {
    return normalizeCharacterRuleset(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_CHARACTER_RULESET;
  }
};

export const setDefaultCharacterRuleset = (ruleset: CharacterRuleset): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, ruleset);
  } catch {
    // Ignore local preference write failures and keep the in-memory selection.
  }
};
