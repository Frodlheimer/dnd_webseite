import type { Ability, RaceEntryMeta, RaceStructuredData } from '../model';

const ABILITY_LABELS: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA'
};

const titleCase = (value: string): string => {
  return value
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

export const formatAbilityBonuses = (abilities: RaceStructuredData['abilities']): string | null => {
  const fixed = Object.entries(abilities.bonuses)
    .map(([ability, amount]) => `${ABILITY_LABELS[ability as Ability]} +${amount}`)
    .join(', ');
  const choice = abilities.bonusChoice
    ? `Choose ${abilities.bonusChoice.choose} ${abilities.bonusChoice.from
        .map((ability) => ABILITY_LABELS[ability])
        .join('/')} +${abilities.bonusChoice.amount}`
    : '';

  const parts = [fixed, choice].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : null;
};

export const formatLanguages = (languages: RaceStructuredData['languages']): string | null => {
  const granted = languages.granted.join(', ');
  const choice = languages.choices
    ? `Choose ${languages.choices.choose} language${languages.choices.choose > 1 ? 's' : ''}`
    : '';
  const parts = [granted, choice].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : null;
};

export const formatSpeed = (basics: RaceStructuredData['basics']): string | null => {
  const parts: string[] = [];
  if (typeof basics.speedWalk === 'number') {
    parts.push(`Walk ${basics.speedWalk} ft`);
  }
  if (typeof basics.speedClimb === 'number') {
    parts.push(`Climb ${basics.speedClimb} ft`);
  }
  if (typeof basics.speedFly === 'number') {
    parts.push(`Fly ${basics.speedFly} ft`);
  }
  if (typeof basics.speedSwim === 'number') {
    parts.push(`Swim ${basics.speedSwim} ft`);
  }
  if (typeof basics.speedBurrow === 'number') {
    parts.push(`Burrow ${basics.speedBurrow} ft`);
  }
  return parts.length > 0 ? parts.join(' | ') : null;
};

export const formatMetaLanguages = (meta: RaceEntryMeta): string => {
  return meta.languagesGranted.length > 0 ? meta.languagesGranted.join(', ') : 'None listed';
};

export const formatRaceTagLabel = (tag: string): string => {
  if (tag.startsWith('kind:')) {
    return titleCase(tag.slice('kind:'.length));
  }
  if (tag.startsWith('source:')) {
    return tag.slice('source:'.length).toUpperCase();
  }
  if (tag.startsWith('size:')) {
    return `Size ${titleCase(tag.slice('size:'.length))}`;
  }
  if (tag.startsWith('speed:')) {
    return `Speed ${tag.slice('speed:'.length)} ft`;
  }
  if (tag.startsWith('darkvision:')) {
    return `Darkvision ${tag.slice('darkvision:'.length)} ft`;
  }
  if (tag.startsWith('language:')) {
    return `Language ${titleCase(tag.slice('language:'.length))}`;
  }
  if (tag.startsWith('parent:')) {
    return `Parent ${titleCase(tag.slice('parent:'.length))}`;
  }
  if (tag.startsWith('has:')) {
    return titleCase(tag.slice('has:'.length).replace(/-/g, ' '));
  }
  return titleCase(tag.replace(/:/g, ' '));
};
