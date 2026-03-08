import type { DiceFace } from '../animation/useDiceAnimation';

const borderBySides: Record<number, string> = {
  4: '#38bdf8',
  6: '#22d3ee',
  8: '#34d399',
  10: '#f59e0b',
  12: '#f97316',
  20: '#f43f5e',
  100: '#a78bfa'
};

type DiceTileProps = {
  roll: DiceFace;
  isAnimating: boolean;
};

export const DiceTile = ({ roll, isAnimating }: DiceTileProps) => {
  const accent = borderBySides[roll.sides] ?? '#38bdf8';

  return (
    <div className="relative h-16 w-16">
      <svg
        viewBox="0 0 64 64"
        width="64"
        height="64"
        role="img"
        aria-label={`d${roll.sides} rolled ${roll.value}`}
      >
        <rect
          x="3"
          y="3"
          width="58"
          height="58"
          rx="12"
          fill="rgba(2, 6, 23, 0.85)"
          stroke={accent}
          strokeWidth={isAnimating ? 2.8 : 2}
        />
        <text
          x="32"
          y="19"
          textAnchor="middle"
          fontSize="10"
          letterSpacing="1"
          fill="#cbd5e1"
          style={{ textTransform: 'uppercase' }}
        >
          d{roll.sides}
        </text>
        <text
          x="32"
          y="44"
          textAnchor="middle"
          fontSize="24"
          fontWeight={700}
          fill="#f8fafc"
        >
          {roll.value}
        </text>
      </svg>
    </div>
  );
};
