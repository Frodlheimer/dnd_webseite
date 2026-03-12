import type { CharacterSheetValues } from '../../characterSheets/types';
import type { CharacterRecord } from '../model/character';
import { rulesFacade } from '../rules/rulesFacade';

const formatSigned = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  return value >= 0 ? `+${value}` : `${value}`;
};

const formatAbility = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  return `${value}`;
};

const formatInventory = (character: CharacterRecord): string => {
  if (character.equipment.items.length === 0) {
    return '';
  }
  return character.equipment.items.map((item) => `${item.quantity}x ${item.name}`).join('\n');
};

const formatFeatures = (character: CharacterRecord): string => {
  const selectedFeatureKeys = Object.keys(character.features.selectedChoices);
  const auto = character.features.autoGranted.map((entry) => entry.id);
  const parts = [...auto, ...selectedFeatureKeys];
  return parts.join('\n').slice(0, 1200);
};

const formatSpellNotes = (character: CharacterRecord): string => {
  const cantrips = character.spells.selectedCantrips.join(', ');
  const known = character.spells.selectedKnownSpells.join(', ');
  const prepared = character.spells.preparedSpells.join(', ');
  const granted = character.spells.grantedSpells.join(', ');
  const lines = [
    cantrips ? `Cantrips: ${cantrips}` : '',
    known ? `Known: ${known}` : '',
    prepared ? `Prepared: ${prepared}` : '',
    granted ? `Granted: ${granted}` : ''
  ].filter(Boolean);
  return lines.join('\n').slice(0, 1400);
};

export const mapCharacterToGeneralSheetValues = async (
  character: CharacterRecord
): Promise<CharacterSheetValues> => {
  const className = character.progression.classId
    ? rulesFacade.findClassName(character.progression.classId)
    : null;
  const subclassName = character.progression.subclassId
    ? rulesFacade.findSubclassName(character.progression.subclassId)
    : null;
  const raceName = await rulesFacade.findRaceName(character.origin.raceId);
  const background = character.origin.backgroundId
    ? rulesFacade.getBackgroundById(character.origin.backgroundId)?.name ?? character.origin.backgroundId
    : '';

  const values: CharacterSheetValues = {
    CharacterName: character.meta.name ?? '',
    'CharacterName 2': character.meta.name ?? '',
    PlayerName: character.meta.playerName ?? '',
    ClassLevel: `${className ?? ''}${character.progression.level ? ` ${character.progression.level}` : ''}`.trim(),
    Background: background,
    Race: raceName ?? '',
    ProfBonus: formatSigned(character.derived.proficiencyBonus),
    STR: formatAbility(character.derived.abilityFinal.str),
    DEX: formatAbility(character.derived.abilityFinal.dex),
    CON: formatAbility(character.derived.abilityFinal.con),
    INT: formatAbility(character.derived.abilityFinal.int),
    WIS: formatAbility(character.derived.abilityFinal.wis),
    CHA: formatAbility(character.derived.abilityFinal.cha),
    STRmod: formatSigned(character.derived.abilityMods.str),
    DEXmod: formatSigned(character.derived.abilityMods.dex),
    CONmod: formatSigned(character.derived.abilityMods.con),
    INTmod: formatSigned(character.derived.abilityMods.int),
    WISmod: formatSigned(character.derived.abilityMods.wis),
    CHamod: formatSigned(character.derived.abilityMods.cha),
    AC: formatAbility(character.derived.armorClass ?? null),
    Initiative: formatSigned(character.derived.initiative),
    Speed: formatAbility(character.derived.speed ?? null),
    HPMax: formatAbility(character.derived.hitPointsMax ?? null),
    Passive: formatAbility(character.derived.passivePerception),
    Equipment: formatInventory(character),
    'Features and Traits': formatFeatures(character),
    AttacksSpellcasting: formatSpellNotes(character),
    'Spellcasting Class 2': className ?? '',
    'SpellcastingAbility 2': subclassName ?? '',
    'SpellSaveDC  2': formatAbility(character.derived.spellSaveDc ?? null),
    'SpellAtkBonus 2': formatSigned(character.derived.spellAttackBonus ?? null)
  };

  if (character.proficiencies.savingThrows.includes('str')) {
    values['ST Strength'] = formatSigned(character.derived.proficiencyBonus);
  }
  if (character.proficiencies.savingThrows.includes('dex')) {
    values['ST Dexterity'] = formatSigned(character.derived.proficiencyBonus);
  }
  if (character.proficiencies.savingThrows.includes('con')) {
    values['ST Constitution'] = formatSigned(character.derived.proficiencyBonus);
  }
  if (character.proficiencies.savingThrows.includes('int')) {
    values['ST Intelligence'] = formatSigned(character.derived.proficiencyBonus);
  }
  if (character.proficiencies.savingThrows.includes('wis')) {
    values['ST Wisdom'] = formatSigned(character.derived.proficiencyBonus);
  }
  if (character.proficiencies.savingThrows.includes('cha')) {
    values['ST Charisma'] = formatSigned(character.derived.proficiencyBonus);
  }

  return values;
};

