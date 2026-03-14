import type { CharacterRecord, Ability } from '../../model/character';
import type { FeatEntryMeta } from '../../../rules/feats/types';
import { RuleReferenceButton } from '../RuleReferenceButton';

const abilityOptions: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const formatAbility = (ability: Ability): string => ability.toUpperCase();

const defaultAsi = (): Partial<Record<Ability, number>> => ({
  str: 1,
  dex: 1
});

const describeFeatAbilityIncrease = (feat: FeatEntryMeta): string | null => {
  const increase = feat.quickFacts.abilityIncrease;
  if (increase.amount <= 0) {
    return null;
  }

  if (increase.mode === 'FIXED') {
    const abilities = increase.abilities
      .filter((ability) => ability !== 'ALL')
      .map((ability) => ability.toUpperCase())
      .join(', ');
    return abilities ? `${abilities} +${increase.amount}` : `+${increase.amount}`;
  }

  if (increase.mode === 'CHOICE') {
    return increase.abilities.includes('ALL')
      ? `Choose an ability for +${increase.amount}`
      : `Choose from ${increase.abilities.join(', ')} for +${increase.amount}`;
  }

  return null;
};

export const AsiFeatsStep = (props: {
  character: CharacterRecord;
  asiLevels: number[];
  feats: FeatEntryMeta[];
  onSetAsiChoice: (args: {
    level: number;
    choice:
      | { kind: 'ASI'; increases: Partial<Record<Ability, number>> }
      | { kind: 'FEAT'; featId: string | null; bonusAssignments?: Partial<Record<Ability, number>> };
  }) => void;
  onOpenFeatReference: (featId: string) => void;
}) => {
  if (!props.character.progression.classId) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
        Choose a class first to unlock class-based ASI / feat opportunities.
      </section>
    );
  }

  if (props.asiLevels.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
        No ASI / feat opportunities are available for the selected class.
      </section>
    );
  }

  const sortedFeats = [...props.feats].sort((left, right) => left.name.localeCompare(right.name));

  return (
    <div className="space-y-3">
      {props.asiLevels
        .filter((level) => level <= props.character.progression.level)
        .map((level) => {
          const current = props.character.featsAndAsi.opportunities.find((entry) => entry.level === level);
          const currentChoice = current?.choice;
          const asiChoice = currentChoice?.kind === 'ASI' ? currentChoice : null;
          const featChoice = currentChoice?.kind === 'FEAT' ? currentChoice : null;
          const selectedFeat = featChoice?.featId
            ? sortedFeats.find((feat) => feat.id === featChoice.featId) ?? null
            : null;
          const selectedFeatAbilityIncrease = selectedFeat ? describeFeatAbilityIncrease(selectedFeat) : null;
          const selectedFeatBonusMode = selectedFeat?.quickFacts.abilityIncrease.mode ?? 'NONE';
          const nextFeatChoice = (): {
            kind: 'FEAT';
            featId: string | null;
            bonusAssignments?: Partial<Record<Ability, number>>;
          } => {
            if (featChoice?.bonusAssignments) {
              return {
                kind: 'FEAT',
                featId: featChoice.featId,
                bonusAssignments: featChoice.bonusAssignments
              };
            }
            return {
              kind: 'FEAT',
              featId: featChoice?.featId ?? null
            };
          };

          return (
            <section key={level} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-100">Level {level}</p>
              </div>

              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    props.onSetAsiChoice({
                      level,
                      choice: {
                        kind: 'ASI',
                        increases: asiChoice ? asiChoice.increases : defaultAsi()
                      }
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    asiChoice
                      ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  ASI
                </button>
                <button
                  type="button"
                  onClick={() =>
                    props.onSetAsiChoice({
                      level,
                      choice: nextFeatChoice()
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    featChoice
                      ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  Feat
                </button>
              </div>

              {asiChoice ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {abilityOptions.map((ability) => (
                    <label key={ability} className="text-xs text-slate-300">
                      {formatAbility(ability)}
                      <input
                        type="number"
                        min={0}
                        max={2}
                        value={asiChoice.increases[ability] ?? 0}
                        onChange={(event) =>
                          props.onSetAsiChoice({
                            level,
                            choice: {
                              kind: 'ASI',
                              increases: {
                                ...asiChoice.increases,
                                [ability]: Number.parseInt(event.target.value, 10)
                              }
                            }
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {featChoice ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-300">
                    Choose one feat for this level. Some feats also grant an ability score increase that must be
                    assigned here.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {sortedFeats.map((feat) => {
                      const selected = featChoice.featId === feat.id;
                      const abilityIncreaseText = describeFeatAbilityIncrease(feat);
                      return (
                        <article
                          key={feat.id}
                          className={`rounded-lg border p-3 text-left ${
                            selected
                              ? 'border-sky-500/80 bg-sky-950/35'
                              : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                props.onSetAsiChoice({
                                  level,
                                  choice: {
                                    ...featChoice,
                                    featId: feat.id
                                  }
                                })
                              }
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="text-sm font-semibold text-slate-100">{feat.name}</p>
                              <p className="mt-1 text-xs text-slate-300">{feat.summary}</p>
                              {feat.quickFacts.prerequisite ? (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  Prerequisite: {feat.quickFacts.prerequisite}
                                </p>
                              ) : null}
                              {abilityIncreaseText ? (
                                <p className="mt-1 text-[11px] text-sky-200">Ability increase: {abilityIncreaseText}</p>
                              ) : null}
                            </button>
                            <RuleReferenceButton
                              label={`Open feat reference for ${feat.name}`}
                              onClick={() => props.onOpenFeatReference(feat.id)}
                            />
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {selectedFeat ? (
                    <section className="rounded-lg border border-slate-700 bg-slate-950/55 p-3">
                      <p className="text-sm font-semibold text-slate-100">Selected feat: {selectedFeat.name}</p>
                      {selectedFeatAbilityIncrease ? (
                        <p className="mt-1 text-xs text-slate-300">Ability increase: {selectedFeatAbilityIncrease}</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">
                          This feat does not add an ability score increase.
                        </p>
                      )}

                      {selectedFeatBonusMode === 'CHOICE' ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {abilityOptions.map((ability) => (
                            <label key={ability} className="text-xs text-slate-300">
                              Feat bonus {formatAbility(ability)}
                              <input
                                type="number"
                                min={0}
                                max={1}
                                value={featChoice.bonusAssignments?.[ability] ?? 0}
                                onChange={(event) =>
                                  props.onSetAsiChoice({
                                    level,
                                    choice: {
                                      ...featChoice,
                                      bonusAssignments: {
                                        ...(featChoice.bonusAssignments ?? {}),
                                        [ability]: Number.parseInt(event.target.value, 10)
                                      }
                                    }
                                  })
                                }
                                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                              />
                            </label>
                          ))}
                        </div>
                      ) : selectedFeatAbilityIncrease ? (
                        <p className="mt-2 text-xs text-slate-400">
                          This feat&apos;s ability increase is applied automatically.
                        </p>
                      ) : null}
                    </section>
                  ) : (
                    <p className="rounded-lg border border-slate-700 bg-slate-950/55 px-3 py-2 text-xs text-slate-400">
                      Choose a feat card to continue.
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
    </div>
  );
};
