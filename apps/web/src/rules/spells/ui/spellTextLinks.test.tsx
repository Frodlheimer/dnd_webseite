import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { renderSpellTextWithLinks } from './spellTextLinks';

describe('renderSpellTextWithLinks', () => {
  it('links detected spell names and skips self links', () => {
    const nodes = renderSpellTextWithLinks('Cast Shield, then Misty Step and Fireball.', {
      currentSlug: 'shield'
    });

    render(
      <MemoryRouter>
        <p>{nodes}</p>
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Shield' })).toBeNull();

    const mistyStep = screen.getByRole('link', { name: 'Misty Step' });
    expect(mistyStep).toHaveAttribute('href', '/rules/spells/misty-step');

    const fireball = screen.getByRole('link', { name: 'Fireball' });
    expect(fireball).toHaveAttribute('href', '/rules/spells/fireball');
  });
});
