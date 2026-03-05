import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../characterSheets/generated/templatesIndex', () => ({
  characterSheetTemplatesIndex: [
    {
      id: 'general',
      title: 'General Character Sheet',
      className: null,
      pdfUrl: '/character_sheets/general.pdf',
      pageCount: 2,
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'wizard',
      title: 'Wizard Character Sheet',
      className: 'Wizard',
      pdfUrl: '/character_sheets/wizard.pdf',
      pageCount: 2,
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  loadCharacterSheetTemplate: vi.fn()
}));

import { CharacterSheetsHubRoute } from './CharacterSheetsHubRoute';

describe('CharacterSheetsHubRoute', () => {
  it('renders available templates from generated index', () => {
    render(
      <MemoryRouter>
        <CharacterSheetsHubRoute />
      </MemoryRouter>
    );

    expect(screen.getByText('General Character Sheet')).toBeInTheDocument();
    expect(screen.getByText('Wizard Character Sheet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Create from template' })).toHaveLength(2);
  });
});
