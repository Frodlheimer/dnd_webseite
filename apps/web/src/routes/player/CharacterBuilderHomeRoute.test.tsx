import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { CharacterBuilderHomeRoute } from './CharacterBuilderHomeRoute';

describe('CharacterBuilderHomeRoute', () => {
  it('renders the builder introduction and quick-start links', () => {
    render(
      <MemoryRouter>
        <CharacterBuilderHomeRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /create a new character/i })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is processed on a server/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start character builder/i })).toHaveAttribute(
      'href',
      '/player/characters/new'
    );
    expect(screen.getByRole('link', { name: /open your characters/i })).toHaveAttribute(
      'href',
      '/player/characters/list'
    );
  });
});
