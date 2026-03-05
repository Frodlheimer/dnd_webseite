import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { localSessionRepository } from '../../local/sessionRepository';
import { GlobalSearch } from './GlobalSearch';

describe('GlobalSearch', () => {
  it('opens search palette with Ctrl/Cmd+K', async () => {
    vi.spyOn(localSessionRepository, 'listRecentSnapshotSummaries').mockResolvedValueOnce([]);

    const view = render(
      <MemoryRouter>
        <GlobalSearch scope="all" />
      </MemoryRouter>
    );

    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, {
      key: 'k',
      ctrlKey: true
    });

    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument();

    await new Promise((resolve) => {
      window.setTimeout(resolve, 180);
    });

    view.unmount();
  });
});
