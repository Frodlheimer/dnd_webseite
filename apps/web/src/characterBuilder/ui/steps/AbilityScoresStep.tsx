import { calculatePointBuy, POINT_BUY_BUDGET } from '../../pointBuy/rules';
import type { CharacterRecord } from '../../model/character';
import { ABILITIES, type Ability } from '../../model/character';

const ABILITY_LABELS: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

export const AbilityScoresStep = (props: {
  character: CharacterRecord;
  onBaseScoreChange: (ability: Ability, next: number) => void;
  onBackgroundAssignmentChange: (ability: Ability, value: number) => void;
  onLegacyAssignmentChange: (ability: Ability, value: number) => void;
}) => {
  const pointBuy = calculatePointBuy({
    STR: props.character.abilities.pointBuyBase.str,
    DEX: props.character.abilities.pointBuyBase.dex,
    CON: props.character.abilities.pointBuyBase.con,
    INT: props.character.abilities.pointBuyBase.int,
    WIS: props.character.abilities.pointBuyBase.wis,
    CHA: props.character.abilities.pointBuyBase.cha
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">
        Points spent: {pointBuy.spent} / {POINT_BUY_BUDGET} | Remaining: {pointBuy.remaining}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ABILITIES.map((ability) => {
          const base = props.character.abilities.pointBuyBase[ability];
          const final = props.character.derived.abilityFinal[ability];
          const mod = props.character.derived.abilityMods[ability];
          return (
            <article key={ability} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p className="text-sm font-semibold text-slate-100">{ABILITY_LABELS[ability]}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => props.onBaseScoreChange(ability, base - 1)}
                  className="rounded border border-slate-600 px-2 py-1 text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min={8}
                  max={15}
                  value={base}
                  onChange={(event) => props.onBaseScoreChange(ability, Number.parseInt(event.target.value, 10))}
                  className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => props.onBaseScoreChange(ability, base + 1)}
                  className="rounded border border-slate-600 px-2 py-1 text-xs"
                >
                  +
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                Final {final} ({mod >= 0 ? '+' : ''}
                {mod})
              </p>
              {props.character.origin.mode === 'SRD_5_2_BACKGROUND' ? (
                <label className="mt-2 block text-xs text-slate-300">
                  Background bonus
                  <input
                    type="number"
                    min={0}
                    max={2}
                    value={props.character.origin.backgroundBonusAssignments?.[ability] ?? 0}
                    onChange={(event) =>
                      props.onBackgroundAssignmentChange(ability, Number.parseInt(event.target.value, 10))
                    }
                    className="mt-1 w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </label>
              ) : (
                <label className="mt-2 block text-xs text-slate-300">
                  Legacy bonus override
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={props.character.origin.legacyRaceBonusAssignments?.[ability] ?? 0}
                    onChange={(event) =>
                      props.onLegacyAssignmentChange(ability, Number.parseInt(event.target.value, 10))
                    }
                    className="mt-1 w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </label>
              )}
            </article>
          );
        })}
      </div>

      {pointBuy.errors.length > 0 ? (
        <div className="rounded border border-rose-500/60 bg-rose-950/30 p-3 text-sm text-rose-100">
          {pointBuy.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <details className="rounded border border-slate-700 bg-slate-950/45 p-3 text-sm text-slate-300">
        <summary className="cursor-pointer font-medium text-sky-200">Point Buy refresher</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          <li>All scores start at 8.</li>
          <li>Point buy caps at 15 before bonuses.</li>
          <li>Even scores are often efficient because modifiers increase at 12/14/16/18/20.</li>
        </ul>
      </details>
    </div>
  );
};

