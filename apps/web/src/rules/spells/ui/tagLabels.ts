export const formatSpellTagLabel = (tag: string): string => {
  if (tag === 'cantrip') {
    return 'Cantrip';
  }

  if (tag === 'concentration:yes') {
    return 'Concentration: Yes';
  }

  if (tag === 'concentration:no') {
    return 'Concentration: No';
  }

  if (tag === 'target:area') {
    return 'Target: Area of Effect';
  }

  if (tag === 'target:self') {
    return 'Target: Self';
  }

  if (tag === 'target:single') {
    return 'Target: Single Target';
  }

  if (tag === 'ritual') {
    return 'Ritual';
  }

  if (tag === 'technomagic') {
    return 'Technomagic';
  }

  if (tag === 'dunamancy') {
    return 'Dunamancy';
  }

  if (tag === 'dunamancy:graviturgy') {
    return 'Dunamancy: Graviturgy';
  }

  if (tag === 'dunamancy:chronurgy') {
    return 'Dunamancy: Chronurgy';
  }

  const [prefix, rawValue] = tag.split(':');
  if (!rawValue) {
    return tag;
  }

  const value = rawValue
    .split('-')
    .filter(Boolean)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1)}`)
    .join(' ');

  if (prefix === 'level') {
    return `Level ${value}`;
  }

  if (prefix === 'school') {
    return `School: ${value}`;
  }

  if (prefix === 'class') {
    return `Class: ${value}`;
  }

  if (prefix === 'source') {
    return `Source: ${value}`;
  }

  if (prefix === 'components') {
    return `Component: ${value.toUpperCase()}`;
  }

  return `${prefix}: ${value}`;
};
