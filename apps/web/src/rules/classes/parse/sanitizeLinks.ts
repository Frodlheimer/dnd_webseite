const LINK_PATTERN = /\[LINK:([^|\]]*)\|([^\]]*)\]/gi;

const collapseWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const sanitizeLinkText = (value: string): string => {
  return collapseWhitespace(value.replace(/wikidot/gi, ''));
};

export const removeWikidotUrls = (input: string): string => {
  return input
    .replace(
      /\bhttps?:\/\/[^\s\]]*wikidot[^\s\]]*/gi,
      ''
    )
    .replace(/[^\s\]]*wikidot[^\s\]]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
};

export const sanitizeLinks = (input: string): string => {
  const withoutMarkers = input.replace(LINK_PATTERN, (_match, rawText: string, rawUrl: string) => {
    const text = sanitizeLinkText(rawText);
    const url = rawUrl.trim();
    if (/wikidot/i.test(url)) {
      return text.length > 0 ? ` ${text} ` : ' ';
    }

    if (text.length > 0) {
      return ` ${text} `;
    }

    return ' ';
  });

  return removeWikidotUrls(withoutMarkers);
};

export const containsWikidot = (input: string): boolean => {
  return /wikidot/i.test(input);
};
