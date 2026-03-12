export type SearchScope = 'all' | 'player' | 'dm';

export type NavigationSearchEntry = {
  id: string;
  label: string;
  description: string;
  path: string;
  scope: SearchScope;
  keywords: string[];
};

export type QuickActionEntry = {
  id: string;
  label: string;
  description: string;
  path: string;
};

export const navigationSearchEntries: NavigationSearchEntry[] = [
  {
    id: 'nav-home',
    label: 'Home',
    description: 'Out-of-game landing page',
    path: '/',
    scope: 'all',
    keywords: ['landing', 'home', 'start']
  },
  {
    id: 'nav-player-hub',
    label: 'Player Hub',
    description: 'Player tools and shortcuts',
    path: '/player',
    scope: 'player',
    keywords: ['player', 'hub', 'tools']
  },
  {
    id: 'nav-player-join',
    label: 'Join Session',
    description: 'Join a room with invite code',
    path: '/player/join',
    scope: 'player',
    keywords: ['join', 'invite', 'code', 'session']
  },
  {
    id: 'nav-player-characters',
    label: 'Characters',
    description: 'Guided character builder, local saves, and export',
    path: '/player/characters',
    scope: 'player',
    keywords: ['character', 'sheet']
  },
  {
    id: 'nav-player-character-sheets',
    label: 'Character Sheets',
    description: 'PDF sheet templates and editor',
    path: '/player/characters/sheets',
    scope: 'player',
    keywords: ['character', 'sheet', 'pdf', 'builder']
  },
  {
    id: 'nav-player-point-buy',
    label: 'Point Buy Calculator',
    description: '5e point buy with SRD and legacy bonus modes',
    path: '/player/characters/point-buy',
    scope: 'player',
    keywords: ['point buy', 'ability scores', 'asi', 'feat', 'calculator']
  },
  {
    id: 'nav-player-notes',
    label: 'Player Notes',
    description: 'Your campaign notes',
    path: '/player/notes',
    scope: 'player',
    keywords: ['notes', 'journal']
  },
  {
    id: 'nav-player-tools',
    label: 'Player Tools',
    description: 'Dice and utility tools',
    path: '/player/tools',
    scope: 'player',
    keywords: ['dice', 'tools', 'utility']
  },
  {
    id: 'nav-dice',
    label: 'Dice',
    description: 'Client-only dice rolling and initiative tools',
    path: '/dice',
    scope: 'all',
    keywords: ['dice', 'roll', 'initiative', 'd20']
  },
  {
    id: 'nav-dm-hub',
    label: 'Dungeon Master Hub',
    description: 'DM overview and controls',
    path: '/dm',
    scope: 'dm',
    keywords: ['dm', 'game master', 'hub']
  },
  {
    id: 'nav-dm-session',
    label: 'Session',
    description: 'Current DM session workspace',
    path: '/dm/session',
    scope: 'dm',
    keywords: ['session', 'prep']
  },
  {
    id: 'nav-dm-maps',
    label: 'Maps & Scenes',
    description: 'Manage maps and scenes',
    path: '/dm/maps',
    scope: 'dm',
    keywords: ['maps', 'scenes', 'battlemap']
  },
  {
    id: 'nav-dm-npcs',
    label: 'NPC Library',
    description: 'NPC references and templates',
    path: '/dm/npcs',
    scope: 'dm',
    keywords: ['npc', 'library']
  },
  {
    id: 'nav-dm-monsters',
    label: 'Monsters (SRD)',
    description: 'Search SRD monsters and add to NPC library',
    path: '/dm/monsters',
    scope: 'dm',
    keywords: ['monsters', 'srd', 'npc', 'initiative']
  },
  {
    id: 'nav-dm-encounters',
    label: 'Encounters',
    description: 'Prepare encounters',
    path: '/dm/encounters',
    scope: 'dm',
    keywords: ['encounter', 'combat']
  },
  {
    id: 'nav-dm-notes',
    label: 'DM Notes',
    description: 'Private DM notes',
    path: '/dm/notes',
    scope: 'dm',
    keywords: ['notes', 'dm']
  },
  {
    id: 'nav-dm-audio',
    label: 'Audio',
    description: 'Sound and ambience controls',
    path: '/dm/audio',
    scope: 'dm',
    keywords: ['audio', 'sound', 'music']
  },
  {
    id: 'nav-dm-backups',
    label: 'Backups',
    description: 'Session backup placeholders',
    path: '/dm/backups',
    scope: 'dm',
    keywords: ['backup', 'export', 'import']
  },
  {
    id: 'nav-help',
    label: 'Help',
    description: 'Documentation and quick help',
    path: '/help',
    scope: 'all',
    keywords: ['help', 'support']
  },
  {
    id: 'nav-rules',
    label: 'Rules',
    description: 'Stats and rules hub',
    path: '/rules',
    scope: 'all',
    keywords: ['rules', 'stats', 'reference']
  },
  {
    id: 'nav-rules-spells',
    label: 'Spells',
    description: 'Built-in spell browser',
    path: '/rules/spells',
    scope: 'all',
    keywords: ['spells', 'magic', 'rules']
  },
  {
    id: 'nav-rules-classes',
    label: 'Classes & Subclasses',
    description: 'Built-in class and subclass browser',
    path: '/rules/classes',
    scope: 'all',
    keywords: ['classes', 'subclasses', 'rules', 'builder']
  },
  {
    id: 'nav-rules-races',
    label: 'Races (SRD)',
    description: 'SRD race references',
    path: '/rules/races',
    scope: 'all',
    keywords: ['races', 'srd', 'ancestry']
  },
  {
    id: 'nav-rules-equipment',
    label: 'Equipment (SRD)',
    description: 'Weapons, armor, gear, and packs',
    path: '/rules/equipment',
    scope: 'all',
    keywords: ['equipment', 'weapons', 'armor', 'gear']
  },
  {
    id: 'nav-rules-adventuring',
    label: 'Adventuring (SRD)',
    description: 'Travel, exploration, and rest rules',
    path: '/rules/adventuring',
    scope: 'all',
    keywords: ['adventuring', 'travel', 'rest', 'exploration']
  },
  {
    id: 'nav-rules-combat',
    label: 'Combat (SRD)',
    description: 'Actions, attacks, and damage rules',
    path: '/rules/combat',
    scope: 'all',
    keywords: ['combat', 'actions', 'attack', 'damage']
  },
  {
    id: 'nav-rules-spellcasting-rules',
    label: 'Spellcasting Rules (SRD)',
    description: 'General spellcasting rules',
    path: '/rules/spellcasting',
    scope: 'all',
    keywords: ['spellcasting', 'components', 'concentration', 'rules']
  },
  {
    id: 'nav-rules-conditions',
    label: 'Conditions (SRD)',
    description: 'Appendix PH-A conditions',
    path: '/rules/conditions',
    scope: 'all',
    keywords: ['conditions', 'blinded', 'prone', 'stunned']
  },
  {
    id: 'nav-rules-magic-items',
    label: 'Magic Items (SRD)',
    description: 'Magic items A-Z',
    path: '/rules/magic-items',
    scope: 'all',
    keywords: ['magic items', 'wondrous', 'attunement']
  },
  {
    id: 'nav-rules-lineages',
    label: 'Races & Lineages',
    description: 'Built-in race and lineage browser',
    path: '/rules/lineages',
    scope: 'all',
    keywords: ['races', 'lineages', 'ancestry', 'rules']
  },
  {
    id: 'nav-rules-feats',
    label: 'Feats',
    description: 'Built-in feat browser with prerequisite and ability filters',
    path: '/rules/feats',
    scope: 'all',
    keywords: ['feats', 'talents', 'prerequisite', 'ability score']
  },
  {
    id: 'nav-rules-srd-attribution',
    label: 'SRD Attribution',
    description: 'CC-BY-4.0 attribution statement',
    path: '/rules/srd-attribution',
    scope: 'all',
    keywords: ['srd', 'attribution', 'license', 'cc-by-4.0']
  },
  {
    id: 'nav-feedback',
    label: 'Feedback',
    description: 'Share feedback and ideas',
    path: '/feedback',
    scope: 'all',
    keywords: ['feedback', 'contact']
  },
  {
    id: 'nav-imprint',
    label: 'Imprint',
    description: 'Legal information',
    path: '/imprint',
    scope: 'all',
    keywords: ['imprint', 'legal']
  },
  {
    id: 'nav-vtt',
    label: 'In-game VTT',
    description: 'Open the battlemap and room UI',
    path: '/vtt',
    scope: 'all',
    keywords: ['vtt', 'battlemap', 'in game']
  },
  {
    id: 'nav-battlemap-oog',
    label: 'Battlemap Sandbox',
    description: 'Open empty out-of-game battlemap test board',
    path: '/battlemap-oog',
    scope: 'all',
    keywords: ['battlemap', 'sandbox', 'out of game', 'testing']
  }
];

export const quickActions: QuickActionEntry[] = [
  {
    id: 'quick-join',
    label: 'Join session...',
    description: 'Open join form',
    path: '/player/join'
  },
  {
    id: 'quick-vtt',
    label: 'Open in-game VTT',
    description: 'Open /vtt',
    path: '/vtt'
  }
];
