import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { spellsWorkerClient } from '../../rules/spells/worker/spellsWorkerClient';
import type { SpellMeta } from '../../rules/spells/types';
import { SpellsListRoute } from './SpellsListRoute';

vi.mock('../../rules/spells/worker/spellsWorkerClient', () => {
  return {
    spellsWorkerClient: {
      getIndex: vi.fn(),
      filter: vi.fn(),
      detail: vi.fn()
    }
  };
});

const SPELL_META_FIXTURE: SpellMeta = {
  slug: 'magic-missile',
  name: 'Magic Missile',
  source: 'PHB',
  level: 1,
  levelLabel: '1st-level',
  school: 'Evocation',
  castingTime: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  components: 'V, S',
  classes: ['Wizard', 'Sorcerer'],
  flags: {
    ritual: false,
    dunamancy: false,
    dunamancyGraviturgy: false,
    dunamancyChronurgy: false,
    technomagic: false
  },
  flagCodes: [],
  tags: ['level:1', 'school:evocation', 'class:wizard', 'target:single', 'concentration:no'],
  nameNormalized: 'magic missile'
};

describe('SpellsListRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(spellsWorkerClient.getIndex).mockResolvedValue({
      allTags: [
        'ritual',
        'level:1',
        'school:evocation',
        'class:wizard',
        'concentration:yes',
        'concentration:no',
        'target:area',
        'target:single',
        'target:self'
      ],
      tagCounts: {
        ritual: 34,
        'level:1': 120,
        'school:evocation': 109,
        'class:wizard': 360,
        'concentration:yes': 61,
        'concentration:no': 463,
        'target:area': 104,
        'target:single': 331,
        'target:self': 89
      },
      groups: {
        levels: ['level:1'],
        schools: ['school:evocation'],
        classes: ['class:wizard'],
        sources: [],
        concentrations: ['concentration:no', 'concentration:yes'],
        targets: ['target:area', 'target:single', 'target:self'],
        flags: ['ritual'],
        misc: []
      }
    });

    vi.mocked(spellsWorkerClient.filter).mockResolvedValue({
      total: 1,
      items: [SPELL_META_FIXTURE]
    });
  });

  it('renders filter categories as dropdowns and applies selection immediately', async () => {
    render(
      <MemoryRouter>
        <SpellsListRoute />
      </MemoryRouter>
    );

    expect(await screen.findByText('Magic Missile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Flags/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Concentration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Effect Target/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Levels/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schools/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Classes/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Flags/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Ritual\b/i }));

    await waitFor(() => {
      const lastCall = vi.mocked(spellsWorkerClient.filter).mock.calls.at(-1);
      expect(lastCall?.[0]?.tagGroups).toEqual(
        expect.arrayContaining([expect.arrayContaining(['ritual'])])
      );
    });

    expect(screen.getByRole('button', { name: /Flags\s+Ritual/i })).toBeInTheDocument();
  });
});
