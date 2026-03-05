const toWords = (value: string): string => {
  return value
    .split('-')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
};

export const formatClassesTagLabel = (tag: string): string => {
  if (tag === 'ua') {
    return 'UA';
  }
  if (tag === 'spellcaster') {
    return 'Spellcaster';
  }

  if (tag.startsWith('setting:')) {
    return `Setting: ${toWords(tag.slice('setting:'.length))}`;
  }
  if (tag.startsWith('caster:')) {
    return `Caster: ${toWords(tag.slice('caster:'.length))}`;
  }
  if (tag.startsWith('has:')) {
    return toWords(tag.slice('has:'.length));
  }
  if (tag.startsWith('class:')) {
    return `Class: ${toWords(tag.slice('class:'.length))}`;
  }
  if (tag.startsWith('kind:')) {
    return `Kind: ${toWords(tag.slice('kind:'.length))}`;
  }

  return toWords(tag);
};
