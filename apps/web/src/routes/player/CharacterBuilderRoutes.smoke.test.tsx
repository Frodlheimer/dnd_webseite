import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { characterRepository } from '../../characterBuilder/storage/characterRepository';
import { CharacterBuilderEditorRoute } from './CharacterBuilderEditorRoute';
import { CharacterBuilderReviewRoute } from './CharacterBuilderReviewRoute';

const createCharacterForTest = async () => {
  const character = await characterRepository.createCharacter();
  character.meta.name = `Smoke-${Date.now()}`;
  character.progression.classId = 'fighter';
  character.origin.raceId = 'lineage:custom';
  character.origin.backgroundId = 'acolyte';
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
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ability scores/i }));
    await waitFor(() => {
      expect(screen.getByText(/Points spent:/i)).toBeInTheDocument();
    });
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

