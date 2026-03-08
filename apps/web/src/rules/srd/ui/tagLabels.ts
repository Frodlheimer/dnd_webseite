const stripPrefix = (value: string): string => {
  const parts = value.split(':');
  if (parts.length <= 1) {
    return value;
  }
  return parts.slice(1).join(':');
};

const titleCase = (value: string): string => {
  return value
    .split(/[-_ ]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
};

const formatCrValue = (value: string): string => {
  return value.replace(/-/g, '/');
};

export const formatSrdTagLabel = (tag: string): string => {
  if (tag.startsWith('cr:')) {
    return `CR ${formatCrValue(stripPrefix(tag))}`;
  }
  if (tag.startsWith('type:')) {
    return `Type: ${titleCase(stripPrefix(tag))}`;
  }
  if (tag.startsWith('size:')) {
    return `Size: ${titleCase(stripPrefix(tag))}`;
  }
  if (tag.startsWith('item:rarity:')) {
    return `Rarity: ${titleCase(tag.replace('item:rarity:', ''))}`;
  }
  if (tag.startsWith('rules:')) {
    return `Rules: ${titleCase(stripPrefix(tag))}`;
  }
  if (tag.startsWith('equipment:')) {
    return `Equipment: ${titleCase(stripPrefix(tag))}`;
  }
  if (tag.startsWith('condition:')) {
    return `Condition: ${titleCase(stripPrefix(tag))}`;
  }
  if (tag.startsWith('race:')) {
    return `Race: ${titleCase(stripPrefix(tag))}`;
  }
  if (tag.startsWith('section:')) {
    return `Section: ${titleCase(stripPrefix(tag))}`;
  }

  return titleCase(tag.replace(/:/g, ' '));
};
