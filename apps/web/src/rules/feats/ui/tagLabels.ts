const ABILITY_TAG_LABELS: Record<string, string> = {
  str: 'Strength +',
  dex: 'Dexterity +',
  con: 'Constitution +',
  int: 'Intelligence +',
  wis: 'Wisdom +',
  cha: 'Charisma +',
  all: 'Any ability +'
};

const toTitle = (value: string): string => {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

export const formatFeatsTagLabel = (tag: string): string => {
  if (tag.startsWith('collection:')) {
    return `Collection: ${toTitle(tag.replace('collection:', ''))}`;
  }
  if (tag.startsWith('source:')) {
    return `Source: ${toTitle(tag.replace('source:', ''))}`;
  }
  if (tag.startsWith('race:')) {
    return `Race: ${toTitle(tag.replace('race:', ''))}`;
  }
  if (tag.startsWith('ability:')) {
    const key = tag.replace('ability:', '');
    return ABILITY_TAG_LABELS[key] ? `Ability: ${ABILITY_TAG_LABELS[key]}` : `Ability: ${toTitle(key)}`;
  }
  if (tag.startsWith('has:')) {
    return `Has: ${toTitle(tag.replace('has:', ''))}`;
  }
  if (tag.startsWith('group:')) {
    return `Group: ${toTitle(tag.replace('group:', ''))}`;
  }

  return toTitle(tag);
};
