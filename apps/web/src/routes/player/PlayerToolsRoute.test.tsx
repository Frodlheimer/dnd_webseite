import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PlayerToolsRoute } from './PlayerToolsRoute';

describe('PlayerToolsRoute', () => {
  it('keeps the converter collapsed until requested and then converts feet to meters', () => {
    render(
      <MemoryRouter>
        <PlayerToolsRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open dice/i })).toHaveAttribute('href', '/dice');
    expect(screen.getByRole('link', { name: /open point buy calculator/i })).toHaveAttribute(
      'href',
      '/player/tools/point-buy'
    );
    expect(screen.queryByLabelText('Feet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /jump to converter/i }));
    fireEvent.change(screen.getByLabelText('Feet'), { target: { value: '30' } });
    expect(screen.getByLabelText('Meters')).toHaveDisplayValue('9.144');
  });
});
