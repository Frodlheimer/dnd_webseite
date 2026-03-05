import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/landing/MiniPixiStage', () => ({
  MiniPixiStage: () => <div data-testid="mini-pixi" />
}));

import { LandingRoute } from './LandingRoute';

describe('LandingRoute', () => {
  it('renders core CTAs and landing shortcuts', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/vtt" element={<p>VTT screen</p>} />
          <Route path="/battlemap-oog" element={<p>Sandbox screen</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join Session' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Battlemap \(Out-of-Game\)/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Resume' }));

    expect(screen.getByText('VTT screen')).toBeInTheDocument();
  });
});
