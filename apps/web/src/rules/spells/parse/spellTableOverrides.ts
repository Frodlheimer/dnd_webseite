import type {
  SpellDescriptionBlock,
  SpellDescriptionListBlock,
  SpellDescriptionTableBlock
} from '../types';

type SpellStructureOverrideBase = {
  slug: string;
  startMarker: string;
  endMarker?: string;
};

type SpellTableOverride = SpellStructureOverrideBase & {
  kind: 'table';
  title: string;
  columns: string[];
  rows: string[][];
};

type SpellListOverride = SpellStructureOverrideBase & {
  kind: 'list';
  title: string;
  items: string[];
};

export type SpellStructureOverride = SpellTableOverride | SpellListOverride;

export const SPELL_STRUCTURE_OVERRIDES: SpellStructureOverride[] = [
  {
    kind: 'table',
    slug: 'animate-objects',
    title: 'Animated Object Statistics',
    columns: ['Size', 'HP', 'AC', 'Attack', 'Ability Scores'],
    rows: [
      ['Tiny', '20', '18', '+8 to hit, 1d4 + 4 damage', 'Str: 4, Dex: 18'],
      ['Small', '25', '16', '+6 to hit, 1d8 + 2 damage', 'Str: 6, Dex: 14'],
      ['Medium', '40', '13', '+5 to hit, 2d6 + 1 damage', 'Str: 10, Dex: 12'],
      ['Large', '50', '10', '+6 to hit, 2d10 + 2 damage', 'Str: 14, Dex: 10'],
      ['Huge', '80', '10', '+8 to hit, 2d12 + 4 damage', 'Str: 18, Dex: 6']
    ],
    startMarker: 'Animated Object Statistics Size HP AC Attack Ability Scores',
    endMarker: 'An animated object is a construct with AC'
  },
  {
    kind: 'table',
    slug: 'chaos-bolt',
    title: 'Chaos Bolt Damage Type',
    columns: ['d8', 'Damage Type'],
    rows: [
      ['1', 'Acid'],
      ['2', 'Cold'],
      ['3', 'Fire'],
      ['4', 'Force'],
      ['5', 'Lightning'],
      ['6', 'Poison'],
      ['7', 'Psychic'],
      ['8', 'Thunder']
    ],
    startMarker:
      'd8 Damage Type 1 Acid 2 Cold 3 Fire 4 Force 5 Lightning 6 Poison 7 Psychic 8 Thunder',
    endMarker: 'If you roll the same number on both d8s'
  },
  {
    kind: 'table',
    slug: 'confusion',
    title: 'Confusion Behavior',
    columns: ['d10', 'Behavior'],
    rows: [
      [
        '1',
        'The creature uses all its movement to move in a random direction. To determine the direction, roll a d8 and assign a direction to each die face. The creature does not take an action this turn.'
      ],
      ['2-6', 'The creature does not move or take actions this turn.'],
      [
        '7-8',
        'The creature uses its action to make a melee attack against a randomly determined creature within its reach. If there is no creature within its reach, the creature does nothing this turn.'
      ],
      ['9-10', 'The creature can act and move normally.']
    ],
    startMarker:
      'd10 Behavior 1 The creature uses all its movement to move in a random direction.',
    endMarker: 'At the end of its turns, an affected target can make a Wisdom saving throw.'
  },
  {
    kind: 'table',
    slug: 'prismatic-spray',
    title: 'Prismatic Spray Rays',
    columns: ['d8', 'Color', 'Ray Effect'],
    rows: [
      [
        '1',
        'Red',
        'The target takes 10d6 fire damage on a failed save, or half as much damage on a successful one.'
      ],
      [
        '2',
        'Orange',
        'The target takes 10d6 acid damage on a failed save, or half as much damage on a successful one.'
      ],
      [
        '3',
        'Yellow',
        'The target takes 10d6 lightning damage on a failed save, or half as much damage on a successful one.'
      ],
      [
        '4',
        'Green',
        'The target takes 10d6 poison damage on a failed save, or half as much damage on a successful one.'
      ],
      [
        '5',
        'Blue',
        'The target takes 10d6 cold damage on a failed save, or half as much damage on a successful one.'
      ],
      [
        '6',
        'Indigo',
        'On a failed save, the target is restrained. It must then make a Constitution saving throw at the end of each of its turns. If it successfully saves three times, the spell ends. If it fails its save three times, it permanently turns to stone and is subjected to the petrified condition. The successes and failures do not need to be consecutive; keep track of both until the target collects three of a kind.'
      ],
      [
        '7',
        'Violet',
        'On a failed save, the target is blinded. It must then make a Wisdom saving throw at the start of your next turn. A successful save ends the blindness. If it fails that save, the creature is transported to another plane of existence of the DMs choosing and is no longer blinded. (Typically, a creature that is on a plane that is not its home plane is banished home, while other creatures are usually cast into the Astral or Ethereal planes.)'
      ],
      ['8', 'Special', 'The target is struck by two rays. Roll twice more, rerolling any 8.']
    ],
    startMarker: 'd8 Color Ray Effect 1 Red',
    endMarker: '8 Special The target is struck by two rays. Roll twice more, rerolling any 8.'
  },
  {
    kind: 'table',
    slug: 'haywire',
    title: 'Haywire Device Effects',
    columns: ['d6', 'Effect'],
    rows: [
      [
        '1',
        'The device shuts down and must be restarted. Do not roll again for this device until it is restarted.'
      ],
      ['2-4', 'The device does not function.'],
      [
        '5',
        'The device experiences a power surge, causing an electric shock to the wielder (if any) and one random creature within 5 feet of the device. Each affected creature must make a Dexterity saving throw against your spell save DC, taking 6d6 lightning damage on a failed save, or half as much damage on a successful one.'
      ],
      ['6', 'The device is usable as normal.']
    ],
    startMarker: 'd6 Effect 1 The device shuts down and must be restarted.',
    endMarker: '6 The device is usable as normal.'
  },
  {
    kind: 'table',
    slug: 'nathairs-mischief',
    title: 'Mischievous Surge',
    columns: ['d4', 'Effect'],
    rows: [
      [
        '1',
        'The smell of apple pie fills the air, and each creature in the cube must succeed on a Wisdom saving throw or become charmed by you until the start of your next turn.'
      ],
      [
        '2',
        'Bouquets of flowers appear all around, and each creature in the cube must succeed on a Dexterity saving throw or be blinded until the start of your next turn as the flowers spray water in their faces.'
      ],
      [
        '3',
        'Each creature in the cube must succeed on a Wisdom saving throw or begin giggling until the start of your next turn. A giggling creature is incapacitated and uses all its movement to move in a random direction.'
      ],
      [
        '4',
        'Drops of molasses appear and hover in the cube, turning it into difficult terrain until the start of your next turn.'
      ]
    ],
    startMarker: 'Mischievous Surge d4 Effect'
  },
  {
    kind: 'table',
    slug: 'nathairs-mischief-ua',
    title: 'Mischievous Surge',
    columns: ['d4', 'Effect'],
    rows: [
      [
        '1',
        'The smell of apple pie fills the air, and each creature in the cube must succeed on a Wisdom saving throw or become charmed by you until the start of your next turn.'
      ],
      [
        '2',
        'Bouquets of flowers appear all around, and each creature in the cube must succeed on a Dexterity saving throw or be blinded until the start of your next turn as the flowers spray water in their faces.'
      ],
      [
        '3',
        'Each creature in the cube must succeed on a Wisdom saving throw or begin giggling until the start of your next turn. A giggling creature is incapacitated and uses all its movement to move in a random direction.'
      ],
      [
        '4',
        'Drops of molasses appear and hover in the cube, turning it into difficult terrain until the start of your next turn.'
      ]
    ],
    startMarker: 'Mischievous Surge d4 Effect'
  },
  {
    kind: 'table',
    slug: 'reality-break',
    title: 'Reality Break Effects',
    columns: ['d10', 'Effect'],
    rows: [
      [
        '1-2',
        'Vision of the Far Realm. The target takes 6d12 psychic damage, and it is stunned until the end of the turn.'
      ],
      [
        '3-5',
        'Rending Rift. The target must make a Dexterity saving throw, taking 8d12 force damage on a failed save, or half as much damage on a successful save.'
      ],
      [
        '6-8',
        'Wormhole. The target is teleported, along with everything it is wearing and carrying, up to 30 feet to an unoccupied space of your choice that you can see. The target also takes 10d12 force damage and is knocked prone.'
      ],
      [
        '9-10',
        'Chill of the Dark Void. The target takes 10d12 cold damage, and it is blinded until the end of the turn.'
      ]
    ],
    startMarker: 'Reality Break Effects d10 Effect'
  },
  {
    kind: 'table',
    slug: 'reincarnate',
    title: 'Reincarnation Table',
    columns: ['d100', 'Race'],
    rows: [
      ['01-04', 'Dragonborn'],
      ['05-13', 'Dwarf, hill'],
      ['14-21', 'Dwarf, mountain'],
      ['22-25', 'Elf, dark'],
      ['26-34', 'Elf, high'],
      ['35-42', 'Elf, wood'],
      ['43-46', 'Gnome, forest'],
      ['47-52', 'Gnome, rock'],
      ['53-56', 'Half-elf'],
      ['57-60', 'Half-orc'],
      ['61-68', 'Halfling, lightfoot'],
      ['69-76', 'Halfling, stout'],
      ['77-96', 'Human'],
      ['97-00', 'Tiefling']
    ],
    startMarker: 'Reincarnation Table d100 Race',
    endMarker: 'The reincarnated creature recalls its former life and experiences.'
  },
  {
    kind: 'table',
    slug: 'summon-lesser-demons',
    title: 'Demons Summoned',
    columns: ['d6', 'Demons Summoned'],
    rows: [
      ['1-2', 'Two demons of challenge rating 1 or lower'],
      ['3-4', 'Four demons of challenge rating 1/2 or lower'],
      ['5-6', 'Eight demons of challenge rating 1/4 or lower']
    ],
    startMarker: 'd6 Demons Summoned',
    endMarker: 'The DM chooses the demons'
  },
  {
    kind: 'table',
    slug: 'teleport',
    title: 'Teleport Destination Outcomes',
    columns: ['Familiarity', 'Mishap', 'Similar Area', 'Off Target', 'On Target'],
    rows: [
      ['Permanent circle', '-', '-', '-', '01-100'],
      ['Associated object', '-', '-', '-', '01-100'],
      ['Very familiar', '01-05', '06-13', '14-24', '25-100'],
      ['Seen casually', '01-33', '34-43', '44-53', '54-100'],
      ['Viewed once', '01-43', '44-53', '54-73', '74-100'],
      ['Description', '01-43', '44-53', '54-73', '74-100'],
      ['False destination', '01-50', '51-100', '-', '-']
    ],
    startMarker: 'Familiarity Mishap Similar Area Off Target On Target',
    endMarker: '"Permanent circle" means'
  },
  {
    kind: 'list',
    slug: 'symbol',
    title: 'Symbol Effects',
    items: [
      'Death. Each target must make a Constitution saving throw, taking 10d10 necrotic damage on a failed save, or half as much damage on a successful save.',
      'Discord. Each target must make a Constitution saving throw. On a failed save, a target bickers and argues with other creatures for 1 minute. During this time, it is incapable of meaningful communication and has disadvantage on attack rolls and ability checks.',
      'Fear. Each target must make a Wisdom saving throw and becomes frightened for 1 minute on a failed save. While frightened, the target drops whatever it is holding and must move at least 20 feet away from the glyph on each of its turns, if able.',
      'Hopelessness. Each target must make a Charisma saving throw. On a failed save, the target is overwhelmed with despair for 1 minute. During this time, it cannot attack or target any creature with harmful abilities, spells, or other magical effects.',
      'Insanity. Each target must make an Intelligence saving throw. On a failed save, the target is driven insane for 1 minute. An insane creature cannot take actions, cannot understand what other creatures say, cannot read, and speaks only in gibberish. The DM controls its movement, which is erratic.',
      'Pain. Each target must make a Constitution saving throw and becomes incapacitated with excruciating pain for 1 minute on a failed save.',
      'Sleep. Each target must make a Wisdom saving throw and falls unconscious for 10 minutes on a failed save. A creature awakens if it takes damage or if someone uses an action to shake or slap it awake.',
      'Stunning. Each target must make a Wisdom saving throw and becomes stunned for 1 minute on a failed save.'
    ],
    startMarker: 'Death. Each target must make a Constitution saving throw',
    endMarker: 'Stunning. Each target must make a Wisdom saving throw and becomes stunned for 1 minute on a failed save.'
  }
];

const TABLE_CANDIDATE_PATTERNS: RegExp[] = [
  /\banimated object statistics\b/i,
  /\bd8\s+damage type\b/i,
  /\bd10\s+behavior\b/i,
  /\bd8\s+color\s+ray effect\b/i,
  /\bmischievous surge\s+d4\s+effect\b/i,
  /\breality break effects\s+d10\s+effect\b/i,
  /\breincarnation table\s+d100\s+race\b/i,
  /\bd6\s+demons summoned\b/i,
  /\bd6\s+effect\b/i,
  /\bfamiliarity\s+mishap\s+similar\s+area\s+off\s+target\s+on\s+target\b/i,
  /\bchoose one of the options below\b/i
];

const GENERIC_DICE_TABLE_HEADER_PATTERN =
  /\b(d4|d6|d8|d10|d12|d20|d100)\s+[A-Z][A-Za-z' ]{2,40}(?:\s+[A-Z][A-Za-z' ]{2,40}){0,4}\b/;
const GENERIC_DICE_TABLE_ROW_PATTERN = /\b(?:\d{1,3}(?:-\d{1,3})?)\s+[A-Z][a-zA-Z'/-]*/g;
const OPTION_LIST_INTRO_PATTERN = /\bchoose one of the options below\b/i;
const OPTION_LIST_ITEM_PATTERN = /\b([A-Z][A-Za-z' -]{2,24})\.\s+[A-Z]/g;

const hasGenericDiceTableSignature = (description: string): boolean => {
  const headerMatch = description.match(GENERIC_DICE_TABLE_HEADER_PATTERN);
  if (!headerMatch || typeof headerMatch.index !== 'number') {
    return false;
  }

  const tail = description.slice(headerMatch.index, headerMatch.index + 1500);
  const rows = tail.match(GENERIC_DICE_TABLE_ROW_PATTERN) ?? [];
  return rows.length >= 4;
};

const hasGenericOptionListSignature = (description: string): boolean => {
  if (!OPTION_LIST_INTRO_PATTERN.test(description)) {
    return false;
  }

  const items = description.match(OPTION_LIST_ITEM_PATTERN) ?? [];
  return items.length >= 4;
};

const toParagraphBlocks = (text: string): SpellDescriptionBlock[] => {
  return text
    .split(/\n\s*\n/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => ({
      type: 'paragraph' as const,
      text: entry
    }));
};

const indexOfIgnoreCase = (source: string, marker: string): number => {
  return source.toLowerCase().indexOf(marker.toLowerCase());
};

const appendParagraphs = (blocks: SpellDescriptionBlock[], text: string): void => {
  for (const paragraph of toParagraphBlocks(text)) {
    blocks.push(paragraph);
  }
};

export const hasTableLikeSignature = (description: string): boolean => {
  return (
    TABLE_CANDIDATE_PATTERNS.some((pattern) => pattern.test(description)) ||
    hasGenericDiceTableSignature(description) ||
    hasGenericOptionListSignature(description)
  );
};

export const buildDescriptionBlocks = (args: {
  slug: string;
  description: string;
}): {
  blocks: SpellDescriptionBlock[];
  restored: boolean;
} => {
  const description = args.description.trim();
  const override = SPELL_STRUCTURE_OVERRIDES.find((entry) => entry.slug === args.slug);

  if (!override) {
    return {
      blocks: [],
      restored: false
    };
  }

  const startIndex = indexOfIgnoreCase(description, override.startMarker);
  if (startIndex < 0) {
    return {
      blocks: [],
      restored: false
    };
  }

  const startOfTail =
    override.endMarker && indexOfIgnoreCase(description, override.endMarker) >= startIndex
      ? indexOfIgnoreCase(description, override.endMarker) + override.endMarker.length
      : description.length;

  const prefixText = description.slice(0, startIndex).trim();
  const tailText = description.slice(startOfTail).trim();
  const blocks: SpellDescriptionBlock[] = [];

  appendParagraphs(blocks, prefixText);

  if (override.kind === 'table') {
    const tableBlock: SpellDescriptionTableBlock = {
      type: 'table',
      title: override.title,
      columns: override.columns,
      rows: override.rows
    };
    blocks.push(tableBlock);
  } else {
    const listBlock: SpellDescriptionListBlock = {
      type: 'list',
      title: override.title,
      items: override.items
    };
    blocks.push(listBlock);
  }

  appendParagraphs(blocks, tailText);

  return {
    blocks,
    restored: true
  };
};
