import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { describe, expect, it, vi } from 'vitest';

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
  });
});
