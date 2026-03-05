import { describe, expect, it } from 'vitest';

import { buildSpellsPackFromText, parseSpellsTxt } from './parseSpellsTxt';

const fixture = `
================================================================================
spell:acid-splash
spell:acid-splash
--------------------------------------------------------------------------------
Source: Player's Handbook
Conjuration cantrip
Casting Time:
1 action
Range:
60 feet
Components:
V, S
Duration:
Instantaneous
You hurl a bubble of acid.
Spell Lists.
Sorcerer
,
Wizard

================================================================================
spell:alarm
spell:alarm
--------------------------------------------------------------------------------
Source: Player's Handbook
1st-level abjuration (ritual)
Casting Time:
1 minute
Range:
30 feet
Components:
V, S, M (a tiny bell and a piece of fine silver wire)
Duration:
8 hours
You set an alarm against unwanted intrusion.
Spell Lists.
Wizard

================================================================================
spell:gift-of-alacrity
spell:gift-of-alacrity
--------------------------------------------------------------------------------
Source: Explorer's Guide to Wildemount
1st-level divination (dunamancy:chronurgy)
Casting Time:
1 minute
Range:
Touch
Components:
V, S
Duration:
8 hours
You touch a willing creature and bestow a limited ability to see into the immediate future.
Spell Lists.
Wizard (Dunamancy)
A 1st level wizard could use this spell to produce enough healing for an entire party without losing any spell slots additionally.

================================================================================
spell:bless
spell:bless
--------------------------------------------------------------------------------
Source: Player's Handbook
1st-level enchantment
Casting Time:
1 action
Range:
30 feet
Components:
V, S, M (a sprinkling of holy water)
Duration:
Concentration, up to 1 minute
You bless up to three creatures of your choice.
Spell Lists.
Cleric
,
Paladin

================================================================================
spell:thunderwave
spell:thunderwave
--------------------------------------------------------------------------------
Source: Player's Handbook
1st-level evocation
Casting Time:
1 action
Range:
Self (15-foot cube)
Components:
V, S
Duration:
Instantaneous
A wave of thunderous force sweeps out from you.
Spell Lists.
Bard
,
Druid
,
Sorcerer
,
Wizard

================================================================================
spell:shield
spell:shield
--------------------------------------------------------------------------------
Source: Player's Handbook
1st-level abjuration
Casting Time:
1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell
Range:
Self
Components:
V, S
Duration:
1 round
An invisible barrier of magical force appears and protects you.
Spell Lists.
Sorcerer
,
Wizard
`;

const markdownFixture = `
================================================================================ ⏎
spell:chaos-bolt ⏎
chaos-bolt ⏎
-------------------------------------------------------------------------------- ⏎
⏎
Source: Xanathar's Guide to Everything ⏎
⏎
_1st-level evocation_ ⏎
⏎
**Casting Time:**1 action ⏎
**Range:**120 feet ⏎
**Components:**V, S ⏎
**Duration:**Instantaneous ⏎
⏎
You hurl an undulating, warbling mass of chaotic energy at one creature in range. ⏎
⏎
| d8 | Damage Type | ⏎
| -- | ----------- | ⏎
| 1  | Acid        | ⏎
| 8  | Thunder     | ⏎
⏎
**At Higher Levels.**When you cast this spell using a spell slot of 2nd level or higher, each target takes 1d6 extra damage. ⏎
⏎
**Spell Lists.**Sorcerer (http://dnd5e.wikidot.com/spells:sorcerer) ⏎
⏎
================================================================================ ⏎
spell:symbol ⏎
symbol ⏎
-------------------------------------------------------------------------------- ⏎
⏎
Source: Player's Handbook ⏎
⏎
_7th-level abjuration_ ⏎
⏎
**Casting Time:**1 minute ⏎
**Range:**Touch ⏎
**Components:**V, S, M (mercury) ⏎
**Duration:**Until dispelled or triggered ⏎
⏎
When you inscribe the glyph, choose one of the options below for its effect. ⏎
⏎
- **Death.**Each target must make a Constitution saving throw. ⏎
⏎
- **Stunning.**Each target must make a Wisdom saving throw. ⏎
⏎
**Spell Lists.**Bard (http://dnd5e.wikidot.com/spells:bard),Wizard (http://dnd5e.wikidot.com/spells:wizard) ⏎
`;

describe('parseSpellsTxt', () => {
  it('parses spell blocks and required fields', () => {
    const spells = parseSpellsTxt(fixture);

    expect(spells).toHaveLength(6);

    const alarm = spells.find((entry) => entry.slug === 'alarm');
    expect(alarm).toBeTruthy();
    expect(alarm?.source).toBe("Player's Handbook");
    expect(alarm?.level).toBe(1);
    expect(alarm?.school).toBe('Abjuration');
    expect(alarm?.components).toContain('M (a tiny bell');
    expect(alarm?.flags.ritual).toBe(true);
  });

  it('builds tags and bitsets in the generated pack shape', () => {
    const pack = buildSpellsPackFromText(fixture);

    expect(pack.count).toBe(6);
    expect(pack.allTags).toContain('cantrip');
    expect(pack.allTags).toContain('ritual');
    expect(pack.allTags).toContain('dunamancy:chronurgy');
    expect(pack.allTags).toContain('class:wizard');
    expect(pack.allTags).toContain('concentration:yes');
    expect(pack.allTags).toContain('concentration:no');
    expect(pack.allTags).toContain('target:area');
    expect(pack.allTags).toContain('target:single');
    expect(pack.allTags).toContain('target:self');

    const chronurgyBits = pack.tagBitsets['dunamancy:chronurgy'];
    expect(chronurgyBits).toBeTruthy();
    expect(pack.detailsBySlug['gift-of-alacrity']?.name).toBe('Gift Of Alacrity');
    expect(pack.detailsBySlug['gift-of-alacrity']?.classes).toEqual(['Wizard']);
    expect(pack.detailsBySlug['thunderwave']?.name).toBe('Thunderwave');
    expect(pack.metas.find((entry) => entry.slug === 'shield')?.tags).toContain('target:self');
    expect(pack.allTags.some((tag) => tag.startsWith('class:a-1st-level'))).toBe(false);
  });

  it('parses markdown export markers, tables, and bullet lists', () => {
    const spells = parseSpellsTxt(markdownFixture);
    expect(spells).toHaveLength(2);

    const chaosBolt = spells.find((entry) => entry.slug === 'chaos-bolt');
    expect(chaosBolt?.castingTime).toBe('1 action');
    expect(chaosBolt?.classes).toEqual(['Sorcerer']);
    expect(chaosBolt?.atHigherLevels).toContain('spell slot of 2nd level');
    const chaosTable = chaosBolt?.descriptionBlocks.find((block) => block.type === 'table');
    expect(chaosTable?.type).toBe('table');
    if (chaosTable?.type === 'table') {
      expect(chaosTable.columns).toEqual(['d8', 'Damage Type']);
      expect(chaosTable.rows).toHaveLength(2);
    }

    const symbol = spells.find((entry) => entry.slug === 'symbol');
    expect(symbol?.classes).toEqual(['Bard', 'Wizard']);
    const symbolList = symbol?.descriptionBlocks.find((block) => block.type === 'list');
    expect(symbolList?.type).toBe('list');
    if (symbolList?.type === 'list') {
      expect(symbolList.title).toBe('Symbol Effects');
      expect(symbolList.items[0]).toContain('Death.');
      expect(symbolList.items[1]).toContain('Stunning.');
    }
  });

  it('removes external wikidot URLs from spell description text', () => {
    const withExternalLink = `
================================================================================ ⏎
spell:test-link-spell ⏎
test-link-spell ⏎
-------------------------------------------------------------------------------- ⏎
⏎
Source: Test Source ⏎
⏎
_1st-level abjuration_ ⏎
⏎
**Casting Time:**1 action ⏎
**Range:**Self ⏎
**Components:**V, S ⏎
**Duration:**Instantaneous ⏎
⏎
An Antimagic Field (http://dnd5e.wikidot.com/spell:antimagic-field)has no effect here. ⏎
This line keeps text but removes links like https://dnd5e.wikidot.com/spell:teleportation-circle entirely. ⏎
⏎
**Spell Lists.**Wizard (http://dnd5e.wikidot.com/spells:wizard) ⏎
`;

    const spells = parseSpellsTxt(withExternalLink);
    expect(spells).toHaveLength(1);

    const detail = spells[0];
    expect(detail?.description).toContain('An Antimagic Field has no effect here.');
    expect(detail?.description).not.toContain('http://');
    expect(detail?.description).not.toContain('https://');
  });

  it('inserts a space for merged lowercase-uppercase words in exported text', () => {
    const mergedWordsFixture = `
================================================================================ ⏎
spell:test-merged-case ⏎
test-merged-case ⏎
-------------------------------------------------------------------------------- ⏎
⏎
Source: Test Source ⏎
⏎
_7th-level conjuration_ ⏎
⏎
**Casting Time:**1 action ⏎
**Range:**10 feet ⏎
**Components:**V, S ⏎
**Duration:**Instantaneous ⏎
⏎
"Permanent circle" means a permanentTeleportation Circle whose sigil sequence you know. ⏎
⏎
**Spell Lists.**Wizard (http://dnd5e.wikidot.com/spells:wizard) ⏎
`;

    const spells = parseSpellsTxt(mergedWordsFixture);
    expect(spells).toHaveLength(1);
    expect(spells[0]?.description).toContain('permanent Teleportation Circle');
  });
});
