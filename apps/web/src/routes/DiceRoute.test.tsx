import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { npcsRepository } from '../dm/npcs/npcsRepository';
import { DiceRoute } from './DiceRoute';

vi.mock('../dice3d/DiceBoxTray', () => {
  const MockTray = forwardRef(
    (
      {
        enabled
      }: {
        enabled: boolean;
      },
      ref
    ) => {
      useImperativeHandle(
        ref,
        () => ({
          isReady: () => true,
          roll: async () => [{ sides: 20, value: 10, modifier: 0 }],
          rollMany: async () => [[{ sides: 20, value: 10, modifier: 0 }]],
          clear: () => undefined
        }),
        []
      );

      if (!enabled) {
        return null;
      }

      return <div data-testid="dicebox-tray-mock">3D Tray Mock</div>;
    }
  );

  return {
    DiceBoxTray: MockTray
  };
});

describe('DiceRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders dice tools and initiative section', async () => {
    vi.spyOn(npcsRepository, 'listNpcs').mockResolvedValueOnce([]);

    render(<DiceRoute />);

    expect(screen.getByRole('heading', { name: 'Dice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Initiative Roller' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'From NPC Library' }));
    expect(await screen.findByText('No NPCs found in your library yet.')).toBeInTheDocument();
  });

  it('renders animation mode selector and mounts 3D tray in 3D mode', async () => {
    vi.spyOn(npcsRepository, 'listNpcs').mockResolvedValueOnce([]);

    render(<DiceRoute />);

    const animationModeElements = screen.getAllByLabelText('Animation mode');
    const animationMode = animationModeElements[0];
    if (!animationMode) {
      throw new Error('Animation mode selector was not rendered.');
    }
    fireEvent.change(animationMode, {
      target: {
        value: '3d'
      }
    });

    expect(await screen.findByTestId('dicebox-tray-mock')).toBeInTheDocument();
    expect(screen.getByText('Cinematic physics enabled: slower throw with softer entry and longer settle time.')).toBeInTheDocument();
    expect(screen.queryByText('Edge calibration')).not.toBeInTheDocument();
    expect(screen.queryByText('Use 3D dice')).not.toBeInTheDocument();
    expect(screen.queryByText('Cinematic roll')).not.toBeInTheDocument();
  });

  it('clears persisted dice history when the page is opened', async () => {
    vi.spyOn(npcsRepository, 'listNpcs').mockResolvedValueOnce([]);

    window.localStorage.setItem(
      'dnd-vtt:dice:history',
      JSON.stringify([
        {
          id: 'legacy-roll',
          ts: 123456,
          notation: '1d20',
          modifier: 0,
          total: 14,
          totalWithModifier: 14,
          groupedRolls: [{ sides: 20, values: [14] }],
          hiddenRollCount: 0
        }
      ])
    );

    render(<DiceRoute />);

    expect(screen.getAllByText('No rolls yet.').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(window.localStorage.getItem('dnd-vtt:dice:history')).toBe('[]');
    });
  });
});
