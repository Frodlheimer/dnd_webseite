const startCase = (value: string): string => {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

export const formatLineagesTagLabel = (tag: string): string => {
  if (tag.startsWith('group:')) {
    return `Group: ${startCase(tag.slice('group:'.length))}`;
  }
  if (tag.startsWith('setting:')) {
    const value = tag.slice('setting:'.length);
    return value === 'none' ? 'Setting: None' : `Setting: ${startCase(value)}`;
  }
  if (tag.startsWith('source:')) {
    return `Source: ${startCase(tag.slice('source:'.length))}`;
  }
  if (tag.startsWith('trait:')) {
    return `Trait: ${startCase(tag.slice('trait:'.length))}`;
  }
  if (tag.startsWith('has:')) {
    return `Has: ${startCase(tag.slice('has:'.length))}`;
  }
  if (tag.startsWith('size:')) {
    return `Size: ${startCase(tag.slice('size:'.length))}`;
  }
  if (tag.startsWith('speed:')) {
    return `Speed: ${tag.slice('speed:'.length)} ft`;
  }
  if (tag.startsWith('kind:')) {
    return `Kind: ${startCase(tag.slice('kind:'.length))}`;
  }
  return startCase(tag);
};
