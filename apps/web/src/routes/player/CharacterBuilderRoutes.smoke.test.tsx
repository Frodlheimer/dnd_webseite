import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyCharacter } from '../../characterBuilder/model/character';
import { rulesFacade } from '../../characterBuilder/rules/rulesFacade';
import { characterRepository } from '../../characterBuilder/storage/characterRepository';
import { AsiFeatsStep } from '../../characterBuilder/ui/steps/AsiFeatsStep';
import { CharacterBuilderEditorRoute } from './CharacterBuilderEditorRoute';
import { CharacterBuilderReviewRoute } from './CharacterBuilderReviewRoute';

const createCharacterForTest = async (options?: {
  level?: number;
  asiOpportunities?: Array<{
    level: number;
    choice:
      | { kind: 'ASI'; increases: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> }
      | {
          kind: 'FEAT';
          featId: string | null;
          bonusAssignments?: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>;
        };
  }>;
}) => {
  const character = await characterRepository.createCharacter();
  character.meta.name = `Smoke-${Date.now()}`;
  character.progression.classId = 'fighter';
  character.progression.level = options?.level ?? 1;
  character.origin.raceId = 'human';
  character.origin.backgroundId = 'acolyte';
  character.featsAndAsi.opportunities = options?.asiOpportunities ?? [];
  await characterRepository.saveCharacter(character);
  return character.id;
};

describe('Character builder route smoke', () => {
  it('renders builder sections and point-buy panel in the guided flow', async () => {
    const characterId = await createCharacterForTest();
    render(
      <MemoryRouter initialEntries={[`/player/characters/${characterId}`]}>
        <Routes>
          <Route path="/player/characters/:characterId" element={<CharacterBuilderEditorRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Character Progress')).toBeInTheDocument();
    expect(screen.getAllByText('Rule Set').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /ability scores/i }));
    await waitFor(() => {
      expect(screen.getByText(/Points spent:/i)).toBeInTheDocument();
      expect(screen.getByText('Guidance')).toBeInTheDocument();
      expect(screen.getByText('Spend remaining point-buy points')).toBeInTheDocument();
    });
  });

  it('renders feat choices as referenceable cards', () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 4;
    character.featsAndAsi.opportunities = [
      {
        level: 4,
        choice: {
          kind: 'FEAT',
          featId: null
        }
      }
    ];

    render(
      <AsiFeatsStep
        character={character}
        asiLevels={[4]}
        feats={rulesFacade.listFeats()}
        onOpenFeatReference={vi.fn()}
        onSetAsiChoice={vi.fn()}
      />
    );

    expect(screen.getByText(/Choose one feat for this level/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /open feat reference for/i }).length).toBeGreaterThan(1);
  });

  it('renders final review route for a character', async () => {
    const characterId = await createCharacterForTest();
    render(
      <MemoryRouter initialEntries={[`/player/characters/${characterId}/review`]}>
        <Routes>
          <Route path="/player/characters/:characterId/review" element={<CharacterBuilderReviewRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Final Review & Export')).toBeInTheDocument();
  });
});
