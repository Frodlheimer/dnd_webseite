import { useEffect, useMemo, useState } from 'react';

import { type DerivedCharacterRuntime } from '../../engine/deriveCharacter';
import type { CharacterRecord } from '../../model/character';
import { ABILITIES, type Ability } from '../../model/character';
import { buildPointBuyGuidance } from '../../pointBuy/guidance';
import {
  calculatePointBuy,
  getModifierForScore,
  type FinalScoreComputation,
  POINT_BUY_BUDGET
} from '../../pointBuy/rules';
import { createAbilityMap, type AbilityMap as PointBuyAbilityMap } from '../../pointBuy/types';
import { raceRulesFacade, type CombinedRaceData } from '../../rules/raceRulesFacade';
import { rulesFacade } from '../../rules/rulesFacade';

const ABILITY_LABELS: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

const BUILDER_TO_POINT_BUY_ABILITY = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA'
} as const;

const sumAssignedValues = (values: Partial<Record<Ability, number>> | undefined): number => {
  return Object.values(values ?? {}).reduce((total, value) => total + (value ?? 0), 0);
};

const toPointBuyMap = (values: Partial<Record<Ability, number>>): PointBuyAbilityMap => {
  const output = createAbilityMap(0);
  ABILITIES.forEach((ability) => {
    output[BUILDER_TO_POINT_BUY_ABILITY[ability]] = values[ability] ?? 0;
  });
  return output;
};

const mergeIntoBuilderAbilityMap = (
  target: Partial<Record<Ability, number>>,
  source: Partial<Record<Ability, number>>
) => {
  ABILITIES.forEach((ability) => {
    const amount = source[ability] ?? 0;
    if (amount > 0) {
      target[ability] = (target[ability] ?? 0) + amount;
    }
  });
};

const deriveBackgroundBonuses = (character: CharacterRecord): Partial<Record<Ability, number>> => {
  if (character.origin.mode !== 'SRD_5_2_BACKGROUND') {
    return {};
  }

  const fromAssignments = character.origin.backgroundBonusAssignments ?? {};
  if (sumAssignedValues(fromAssignments) > 0) {
    return fromAssignments;
  }

  const triplet = character.origin.selectedBackgroundAbilityTriplet ?? ['str', 'dex', 'con'];
  const pattern = character.origin.backgroundBonusPattern ?? 'plus2_plus1';
  if (pattern === 'plus1_plus1_plus1') {
    const output: Partial<Record<Ability, number>> = {};
    triplet.forEach((ability) => {
      output[ability] = 1;
    });
    return output;
  }

  const output: Partial<Record<Ability, number>> = {};
  if (triplet[0]) {
    output[triplet[0]] = 2;
  }
  if (triplet[1]) {
    output[triplet[1]] = 1;
  }
  return output;
};

const deriveAdvancementBreakdown = (character: CharacterRecord): {
  asi: PointBuyAbilityMap;
  feat: PointBuyAbilityMap;
} => {
  const asi = createAbilityMap(0);
  const feat = createAbilityMap(0);

  character.featsAndAsi.opportunities.forEach((opportunity) => {
    if (opportunity.level > character.progression.level) {
      return;
    }

    const choice = opportunity.choice;
    if (choice.kind === 'ASI') {
      ABILITIES.forEach((ability) => {
        const amount = choice.increases[ability] ?? 0;
        if (amount > 0) {
          asi[BUILDER_TO_POINT_BUY_ABILITY[ability]] += amount;
        }
      });
      return;
    }

    if (!choice.featId) {
      return;
    }

    const featMeta = rulesFacade.getFeatById(choice.featId);
    if (!featMeta || featMeta.quickFacts.abilityIncrease.amount <= 0) {
      return;
    }

    const amount = featMeta.quickFacts.abilityIncrease.amount;
    if (featMeta.quickFacts.abilityIncrease.mode === 'FIXED') {
      const fixedAbility = featMeta.quickFacts.abilityIncrease.abilities[0];
      const normalizedAbility = fixedAbility?.toLowerCase() as Ability | undefined;
      if (normalizedAbility && ABILITIES.includes(normalizedAbility)) {
        feat[BUILDER_TO_POINT_BUY_ABILITY[normalizedAbility]] += amount;
      }
      return;
    }

    ABILITIES.forEach((ability) => {
      const assignment = choice.bonusAssignments?.[ability] ?? 0;
      if (assignment > 0) {
        feat[BUILDER_TO_POINT_BUY_ABILITY[ability]] += assignment;
      }
    });
  });

  return {
    asi,
    feat
  };
};

const buildFinalScoreComputation = (args: {
  base: PointBuyAbilityMap;
  bonus: PointBuyAbilityMap;
  asi: PointBuyAbilityMap;
  feat: PointBuyAbilityMap;
}): FinalScoreComputation => {
  const byAbility = {
    STR: {
      base: 0,
      bonus: 0,
      asi: 0,
      raw: 0,
      final: 0,
      modifier: 0
    },
    DEX: {
      base: 0,
      bonus: 0,
      asi: 0,
      raw: 0,
      final: 0,
      modifier: 0
    },
    CON: {
      base: 0,
      bonus: 0,
      asi: 0,
      raw: 0,
      final: 0,
      modifier: 0
    },
    INT: {
      base: 0,
      bonus: 0,
      asi: 0,
      raw: 0,
      final: 0,
      modifier: 0
    },
    WIS: {
      base: 0,
      bonus: 0,
      asi: 0,
      raw: 0,
      final: 0,
      modifier: 0
    },
    CHA: {
      base: 0,
      bonus: 0,
      asi: 0,
      raw: 0,
      final: 0,
      modifier: 0
    }
  };
  const capOverflow = createAbilityMap(0);
  const advancementTotal = createAbilityMap(0);
  const errors: string[] = [];

  (Object.keys(BUILDER_TO_POINT_BUY_ABILITY) as Ability[]).forEach((builderAbility) => {
    const pointBuyAbility = BUILDER_TO_POINT_BUY_ABILITY[builderAbility];
    const base = args.base[pointBuyAbility] ?? 0;
    const bonus = args.bonus[pointBuyAbility] ?? 0;
    const asi = (args.asi[pointBuyAbility] ?? 0) + (args.feat[pointBuyAbility] ?? 0);
    const raw = base + bonus + asi;
    const final = Math.min(20, raw);

    advancementTotal[pointBuyAbility] = asi;
    capOverflow[pointBuyAbility] = Math.max(0, raw - final);
    if (raw > 20) {
      errors.push(`${ABILITY_LABELS[builderAbility]} exceeds 20 and is clamped.`);
    }

    byAbility[pointBuyAbility] = {
      base,
      bonus,
      asi,
      raw,
      final,
      modifier: getModifierForScore(final)
    };
  });

  return {
    byAbility,
    asiIncreases: advancementTotal,
    advancement: {
      asi: args.asi,
      feat: args.feat,
      total: advancementTotal
    },
    capOverflow,
    errors
  };
};

const countUnresolvedImprovementSlots = (character: CharacterRecord, asiLevels: number[]): number => {
  return asiLevels
    .filter((level) => level <= character.progression.level)
    .reduce((count, level) => {
      const opportunity = character.featsAndAsi.opportunities.find((entry) => entry.level === level);
      if (!opportunity) {
        return count + 1;
      }

      if (opportunity.choice.kind === 'ASI') {
        return sumAssignedValues(opportunity.choice.increases) > 0 ? count : count + 1;
      }

      if (!opportunity.choice.featId) {
        return count + 1;
      }

      const featMeta = rulesFacade.getFeatById(opportunity.choice.featId);
      if (!featMeta || featMeta.quickFacts.abilityIncrease.amount <= 0) {
        return count;
      }

      if (featMeta.quickFacts.abilityIncrease.mode === 'FIXED') {
        return count;
      }

      return sumAssignedValues(opportunity.choice.bonusAssignments) >= featMeta.quickFacts.abilityIncrease.amount
        ? count
        : count + 1;
    }, 0);
};

export const AbilityScoresStep = (props: {
  character: CharacterRecord;
  originRuntime: DerivedCharacterRuntime['origin'];
  asiLevels: number[];
  onBaseScoreChange: (ability: Ability, next: number) => void;
  onBackgroundAssignmentChange: (ability: Ability, value: number) => void;
  onRaceAssignmentChange: (ability: Ability, value: number) => void;
}) => {
  const [combinedRaceData, setCombinedRaceData] = useState<CombinedRaceData | null | undefined>(null);

  useEffect(() => {
    if (props.character.origin.mode !== 'LEGACY_RACE' || !props.character.origin.raceId) {
      setCombinedRaceData(null);
      return;
    }

    let cancelled = false;
    setCombinedRaceData(undefined);
    void raceRulesFacade
      .getCombinedRaceData(props.character.origin.raceId, props.character.origin.subraceId)
      .then((data) => {
        if (!cancelled) {
          setCombinedRaceData(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCombinedRaceData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    props.character.origin.mode,
    props.character.origin.raceId,
    props.character.origin.subraceId
  ]);

  const pointBuyBaseScores = useMemo(() => {
    return toPointBuyMap(props.character.abilities.pointBuyBase);
  }, [props.character.abilities.pointBuyBase]);

  const pointBuy = useMemo(() => calculatePointBuy(pointBuyBaseScores), [pointBuyBaseScores]);
  const advancementBreakdown = useMemo(() => deriveAdvancementBreakdown(props.character), [props.character]);

  const originBonuses = useMemo(() => {
    const output: Partial<Record<Ability, number>> = {};

    if (props.character.origin.mode === 'SRD_5_2_BACKGROUND') {
      mergeIntoBuilderAbilityMap(output, deriveBackgroundBonuses(props.character));
      return toPointBuyMap(output);
    }

    if (combinedRaceData?.abilityBonuses) {
      mergeIntoBuilderAbilityMap(output, combinedRaceData.abilityBonuses);
    }
    mergeIntoBuilderAbilityMap(output, props.character.origin.legacyRaceBonusAssignments ?? {});
    return toPointBuyMap(output);
  }, [
    combinedRaceData,
    props.character,
    props.character.origin.legacyRaceBonusAssignments
  ]);

  const finalComputation = useMemo(() => {
    return buildFinalScoreComputation({
      base: pointBuyBaseScores,
      bonus: originBonuses,
      asi: advancementBreakdown.asi,
      feat: advancementBreakdown.feat
    });
  }, [advancementBreakdown.asi, advancementBreakdown.feat, originBonuses, pointBuyBaseScores]);

  const unresolvedImprovementSlots = useMemo(() => {
    return countUnresolvedImprovementSlots(props.character, props.asiLevels);
  }, [props.asiLevels, props.character]);

  const isLoadingRaceEffects =
    props.character.origin.mode === 'LEGACY_RACE' &&
    Boolean(props.character.origin.raceId) &&
    combinedRaceData === undefined;

  const guidanceItems = useMemo(() => {
    if (isLoadingRaceEffects) {
      return [];
    }

    return buildPointBuyGuidance({
      classId: props.character.progression.classId ?? '',
      baseScores: pointBuyBaseScores,
      pointRemaining: pointBuy.remaining,
      finalComputation,
      classSelected: Boolean(props.character.progression.classId),
      bonusMode: props.character.origin.mode === 'LEGACY_RACE' ? 'LEGACY_RACE' : 'SRD_BACKGROUND',
      legacyRaceSelected: Boolean(props.character.origin.raceId),
      asiOpportunityCount: props.asiLevels.filter((level) => level <= props.character.progression.level).length,
      unresolvedImprovementSlots,
      multiclassEnabled: false,
      multiclassPrimaryClassId: props.character.progression.classId ?? '',
      multiclassSecondaryClassId: ''
    });
  }, [
    finalComputation,
    isLoadingRaceEffects,
    pointBuy.remaining,
    pointBuyBaseScores,
    props.asiLevels,
    props.character.origin.mode,
    props.character.origin.raceId,
    props.character.progression.classId,
    props.character.progression.level,
    unresolvedImprovementSlots
  ]);

  const validationItems = useMemo(() => {
    return [...new Set([...pointBuy.errors, ...finalComputation.errors])];
  }, [finalComputation.errors, pointBuy.errors]);

  const raceAbilityChoice =
    props.character.origin.mode === 'LEGACY_RACE' ? props.originRuntime.raceAbilityBonusChoice : null;
  const selectedRaceAbilityChoicesCount = raceAbilityChoice
    ? raceAbilityChoice.from.filter(
        (ability) => (props.character.origin.legacyRaceBonusAssignments?.[ability] ?? 0) > 0
      ).length
    : 0;

  const abilityRows = useMemo(() => {
    return ABILITIES.map((ability) => {
      const pointBuyAbility = BUILDER_TO_POINT_BUY_ABILITY[ability];
      const base = pointBuyBaseScores[pointBuyAbility];
      const finalScore = props.character.derived.abilityFinal[ability];
      const finalModifier = props.character.derived.abilityMods[ability];
      const computedRow = finalComputation.byAbility[pointBuyAbility];

      return {
        ability,
        shortLabel: ability.toUpperCase(),
        label: ABILITY_LABELS[ability],
        base,
        baseCost: pointBuy.perAbility[pointBuyAbility].cost,
        baseModifier: getModifierForScore(base),
        final: finalScore,
        finalModifier,
        bonus: computedRow.bonus,
        asi: finalComputation.advancement.asi[pointBuyAbility],
        feat: finalComputation.advancement.feat[pointBuyAbility],
        raw: computedRow.raw,
        capOverflow: finalComputation.capOverflow[pointBuyAbility]
      };
    });
  }, [finalComputation, pointBuy.perAbility, pointBuyBaseScores, props.character.derived]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Ability scores</h3>
            <p className="mt-1 text-sm text-slate-400">
              Core point-buy editing with immediate final-score feedback.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Current class: {rulesFacade.findClassName(props.character.progression.classId ?? '') ?? 'Choose class'}
            </p>
          </div>
          <p className="text-sm text-slate-300">
            Points spent: {pointBuy.spent} / {POINT_BUY_BUDGET} | Remaining: {pointBuy.remaining}
          </p>
        </div>
      </section>

      {validationItems.length > 0 ? (
        <section className="rounded-xl border border-rose-500/45 bg-rose-950/25 p-3.5">
          <h3 className="text-sm font-semibold text-rose-100">Validation and caps</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-100/85">
            {validationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-800/70 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Guidance</h3>
          <p className="text-xs text-slate-500">Class-aware and efficiency hints</p>
        </div>
        {isLoadingRaceEffects ? (
          <p className="mt-2.5 rounded-lg border border-slate-700/70 bg-slate-950/55 px-3 py-2 text-sm text-slate-300">
            Loading selected race effects into the guidance breakdown...
          </p>
        ) : guidanceItems.length > 0 ? (
          <ul className="mt-2.5 space-y-1.5">
            {guidanceItems.map((hint, index) => (
              <li
                key={hint.id}
                className={`rounded-lg border px-3 py-2 text-sm leading-5 ${
                  hint.severity === 'warning' && index === 0
                    ? 'border-amber-500/45 bg-amber-950/25 text-amber-100'
                    : 'border-slate-700/70 bg-slate-950/55 text-slate-300'
                }`}
              >
                {hint.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 rounded-lg border border-slate-700/70 bg-slate-950/55 px-3 py-2 text-sm text-slate-300">
            No unusual choices detected for this setup.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {abilityRows.map((row) => (
            <article
              key={row.ability}
              className={`rounded-xl border p-4 ${
                row.capOverflow > 0
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-slate-800/80 bg-slate-950/65'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{row.shortLabel}</p>
                  <p className="text-lg font-semibold text-slate-100">{row.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Final</p>
                  <p className="text-3xl font-semibold leading-none text-slate-100">{row.final}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Mod {row.finalModifier >= 0 ? '+' : ''}
                    {row.finalModifier}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${row.label} base score`}
                  onClick={() => props.onBaseScoreChange(row.ability, row.base - 1)}
                  className="h-10 w-10 rounded-md border border-slate-700/80 bg-slate-900 text-lg text-slate-100 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                >
                  -
                </button>
                <div
                  aria-label={`${row.label} base score`}
                  aria-live="polite"
                  className="flex h-10 w-20 items-center justify-center rounded-md border border-slate-700/80 bg-slate-950 px-2 text-center text-xl font-semibold text-slate-100"
                >
                  {row.base}
                </div>
                <button
                  type="button"
                  aria-label={`Increase ${row.label} base score`}
                  onClick={() => props.onBaseScoreChange(row.ability, row.base + 1)}
                  className="h-10 w-10 rounded-md border border-slate-700/80 bg-slate-900 text-lg text-slate-100 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                >
                  +
                </button>
                <div className="ml-auto text-right text-sm text-slate-400">
                  <p>Cost {row.baseCost ?? '-'}</p>
                  <p>
                    Base mod {row.baseModifier >= 0 ? '+' : ''}
                    {row.baseModifier}
                  </p>
                </div>
              </div>

              {props.character.origin.mode === 'SRD_5_2_BACKGROUND' ? (
                <label className="mt-3 block text-sm text-slate-300">
                  Background bonus
                  <input
                    type="number"
                    min={0}
                    max={2}
                    value={props.character.origin.backgroundBonusAssignments?.[row.ability] ?? 0}
                    onChange={(event) =>
                      props.onBackgroundAssignmentChange(row.ability, Number.parseInt(event.target.value, 10))
                    }
                    className="mt-1 w-20 rounded-lg border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/40"
                  />
                </label>
              ) : null}

              <details className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/55 px-3 py-2.5 text-sm text-slate-400">
                <summary className="cursor-pointer font-medium text-slate-300">Details</summary>
                <div className="mt-2 space-y-1">
                  <p>Base: {row.base}</p>
                  <p>
                    Origin bonus: {row.bonus >= 0 ? '+' : ''}
                    {row.bonus}
                  </p>
                  <p>
                    ASI: {row.asi >= 0 ? '+' : ''}
                    {row.asi}
                  </p>
                  <p>
                    Feat: {row.feat >= 0 ? '+' : ''}
                    {row.feat}
                  </p>
                  <p>Raw total: {row.raw}</p>
                  <p className={row.capOverflow > 0 ? 'text-amber-200' : 'text-slate-400'}>
                    Final: {row.final}
                    {row.capOverflow > 0 ? ` (capped, overflow ${row.capOverflow})` : ''}
                  </p>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      {props.character.origin.mode === 'LEGACY_RACE' && props.character.origin.raceId ? (
        raceAbilityChoice ? (
          <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-100">Race ability bonus choices</p>
                <p className="text-xs text-slate-300">
                  Select {raceAbilityChoice.choose} ability score
                  {raceAbilityChoice.choose > 1 ? 's' : ''} to gain +{raceAbilityChoice.amount}.
                </p>
              </div>
              <p className="text-xs text-sky-200">
                Selected {selectedRaceAbilityChoicesCount} / {raceAbilityChoice.choose}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {raceAbilityChoice.from.map((ability) => {
                const selected = (props.character.origin.legacyRaceBonusAssignments?.[ability] ?? 0) > 0;
                const atLimit = selectedRaceAbilityChoicesCount >= raceAbilityChoice.choose;
                return (
                  <button
                    key={ability}
                    type="button"
                    onClick={() =>
                      props.onRaceAssignmentChange(ability, selected ? 0 : raceAbilityChoice.amount)
                    }
                    disabled={!selected && atLimit}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selected
                        ? 'border-sky-400 bg-sky-950/50 text-sky-100'
                        : 'border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-500'
                    } ${!selected && atLimit ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {ABILITY_LABELS[ability]}
                    {selected ? ` +${raceAbilityChoice.amount}` : ''}
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="text-xs text-slate-400">
            Race ability bonuses for the selected race are fixed and are applied automatically.
          </p>
        )
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
