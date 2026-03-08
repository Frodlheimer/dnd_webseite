import type { DiceFace } from '../animation/useDiceAnimation';
import { DiceTile } from './DiceTile';

const DEFAULT_MAX_VISIBLE = 120;

type DiceTrayProps = {
  rolls: DiceFace[];
  isAnimating: boolean;
  maxVisible?: number;
};

export const DiceTray = ({ rolls, isAnimating, maxVisible = DEFAULT_MAX_VISIBLE }: DiceTrayProps) => {
  if (rolls.length === 0) {
    return null;
  }

  const visibleRolls = rolls.slice(0, maxVisible);
  const hiddenCount = Math.max(0, rolls.length - visibleRolls.length);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dice Tray</p>
        {isAnimating ? (
          <span className="rounded-full border border-sky-500/50 bg-sky-950/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-sky-200">
            Rolling...
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleRolls.map((roll, index) => (
          <DiceTile key={`${roll.sides}-${roll.value}-${index}`} roll={roll} isAnimating={isAnimating} />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          Showing first {visibleRolls.length} dice, {hiddenCount} additional dice hidden.
        </p>
      ) : null}
    </section>
  );
};
