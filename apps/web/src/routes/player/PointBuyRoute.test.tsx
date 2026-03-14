import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PointBuyRoute } from './PointBuyRoute';

describe('PointBuyRoute', () => {
  it('renders character level as an input without the extra level slider control', () => {
    render(<PointBuyRoute />);

    expect(screen.getByLabelText('Character level')).toBeInTheDocument();
    expect(screen.queryByText('Level slider')).not.toBeInTheDocument();
  });
});
