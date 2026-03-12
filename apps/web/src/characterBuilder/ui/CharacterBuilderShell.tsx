import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { deriveCharacter, type DerivedCharacterRuntime } from '../engine/deriveCharacter';
import {
  invalidateForBackgroundChange,
  invalidateForClassChange,
  invalidateForLevelChange,
  invalidateForOriginModeChange,
  invalidateForRaceChange,
  invalidateForSubclassChange
} from '../engine/choiceResolution';
import type { CharacterRecord, PendingDecision } from '../model/character';
import { BUILDER_SECTION_LABELS, type BuilderSectionId } from '../model/decisions';
import { type BuilderBackground, type BuilderClassSummary, type BuilderRaceSummary, rulesFacade } from '../rules/rulesFacade';
import { characterRepository } from '../storage/characterRepository';
import { BuilderSidebar, type BuilderSidebarItem } from './BuilderSidebar';
import { DecisionPanel } from './DecisionPanel';
import { SectionCard } from './SectionCard';
import { AbilityScoresStep } from './steps/AbilityScoresStep';
import { AsiFeatsStep } from './steps/AsiFeatsStep';
import { BasicsStep } from './steps/BasicsStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { FeaturesStep } from './steps/FeaturesStep';
import { OriginStep } from './steps/OriginStep';
import { ProficienciesStep } from './steps/ProficienciesStep';
import { SpellsStep } from './steps/SpellsStep';

const defaultRuntime: DerivedCharacterRuntime = {
  classSkillChoice: {
    choose: 0,
    options: []
  },
  featureChoices: [],
  equipmentChoices: [],
  spellLimits: {
    casterType: 'NONE',
    isPreparedCaster: false,
    isKnownSpellsCaster: false,
    isSpellbookCaster: false,
    cantripsKnown: null,
    spellsKnown: null,
    preparedFormula: null,
    preparedMax: null
  },
  availableSpells: [],
  maxSpellLevel: 0,
  subclassRequired: false,
  asiLevels: []
};

const sectionOrder: BuilderSectionId[] = [
  'basics',
  'origin',
  'ability_scores',
  'proficiencies',
  'features',
  'spells',
  'equipment',
  'asi_feats',
  'review'
];

const sectionFromDecision = (decision: PendingDecision): BuilderSectionId | null => {
  const normalized = decision.section.toLowerCase();
  if (normalized.includes('basic')) {
    return 'basics';
  }
  if (normalized.includes('origin')) {
    return 'origin';
  }
  if (normalized.includes('ability')) {
    return 'ability_scores';
  }
  if (normalized.includes('proficien')) {
    return 'proficiencies';
  }
  if (normalized.includes('feature')) {
    return 'features';
  }
  if (normalized.includes('spell')) {
    return 'spells';
  }
  if (normalized.includes('equipment')) {
    return 'equipment';
  }
  if (normalized.includes('asi') || normalized.includes('feat')) {
    return 'asi_feats';
  }
  return null;
};

const sectionFromValidation = (section: string): BuilderSectionId | null => {
  const normalized = section.toLowerCase();
  if (normalized.includes('basic')) {
    return 'basics';
  }
  if (normalized.includes('origin')) {
    return 'origin';
  }
  if (normalized.includes('ability')) {
    return 'ability_scores';
  }
  if (normalized.includes('proficien')) {
    return 'proficiencies';
  }
  if (normalized.includes('feature')) {
    return 'features';
  }
  if (normalized.includes('spell')) {
    return 'spells';
  }
  if (normalized.includes('equipment')) {
    return 'equipment';
  }
  if (normalized.includes('feat') || normalized.includes('asi')) {
    return 'asi_feats';
  }
  return null;
};

const cloneCharacter = (character: CharacterRecord): CharacterRecord => structuredClone(character);

export const CharacterBuilderShell = (props: {
  characterId: string;
  initialSection?: BuilderSectionId;
  hideReviewLink?: boolean;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editableCharacter, setEditableCharacter] = useState<CharacterRecord | null>(null);
  const [derivedCharacter, setDerivedCharacter] = useState<CharacterRecord | null>(null);
  const [runtime, setRuntime] = useState<DerivedCharacterRuntime>(defaultRuntime);
  const [activeSection, setActiveSection] = useState<BuilderSectionId>(props.initialSection ?? 'basics');
  const [classes, setClasses] = useState<BuilderClassSummary[]>(() => rulesFacade.listPlayableClasses());
  const [races, setRaces] = useState<BuilderRaceSummary[]>([]);
  const [backgrounds, setBackgrounds] = useState<BuilderBackground[]>(() => rulesFacade.listBackgrounds());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void characterRepository
      .getCharacter(props.characterId)
      .then((character) => {
        if (cancelled) {
          return;
        }
        if (!character) {
          setError('Character not found.');
          setEditableCharacter(null);
          return;
        }
        setEditableCharacter(character);
        setError(null);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load character.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.characterId]);

  useEffect(() => {
    if (!editableCharacter) {
      return;
    }
    let cancelled = false;
    void deriveCharacter(editableCharacter)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setDerivedCharacter(result.character);
        setRuntime(result.runtime);
      })
      .catch((deriveError) => {
        if (!cancelled) {
          setError(deriveError instanceof Error ? deriveError.message : 'Failed to derive character.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editableCharacter]);

  useEffect(() => {
    if (!derivedCharacter) {
      return;
    }
    characterRepository.saveCharacterDebounced(derivedCharacter);
  }, [derivedCharacter]);

  useEffect(() => {
    if (!editableCharacter) {
      return;
    }
    let cancelled = false;
    void rulesFacade
      .listRacesOrSpecies(editableCharacter.origin.mode)
      .then((rows) => {
        if (!cancelled) {
          setRaces(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRaces([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editableCharacter?.origin.mode]);

  useEffect(() => {
    setClasses(rulesFacade.listPlayableClasses());
    setBackgrounds(rulesFacade.listBackgrounds());
  }, []);

  const updateEditable = (updater: (current: CharacterRecord) => CharacterRecord) => {
    setEditableCharacter((current) => {
      if (!current) {
        return current;
      }
      const next = updater(cloneCharacter(current));
      next.updatedAt = Date.now();
      return next;
    });
  };

  const forceSaveNow = async () => {
    if (!editableCharacter) {
      return;
    }
    const result = await deriveCharacter(editableCharacter);
    await characterRepository.saveCharacter(result.character);
    await characterRepository.saveAutosaveSnapshot(result.character.id, result.character);
    setDerivedCharacter(result.character);
    setRuntime(result.runtime);
  };

  const subclasses = useMemo(() => {
    if (!editableCharacter?.progression.classId) {
      return [];
    }
    return rulesFacade.listSubclassesForClass(
      editableCharacter.progression.classId,
      editableCharacter.progression.level
    );
  }, [editableCharacter?.progression.classId, editableCharacter?.progression.level]);

  const sidebarItems = useMemo<BuilderSidebarItem[]>(() => {
    const current = derivedCharacter ?? editableCharacter;
    if (!current) {
      return sectionOrder.map((id) => ({ id, status: 'locked', pendingCount: 0 }));
    }

    const pendingBySection = new Map<BuilderSectionId, number>();
    current.validation.pendingDecisions.forEach((decision) => {
      const section = sectionFromDecision(decision);
      if (!section) {
        return;
      }
      pendingBySection.set(section, (pendingBySection.get(section) ?? 0) + 1);
    });

    const warningsBySection = new Map<BuilderSectionId, number>();
    current.validation.errors.concat(current.validation.warnings).forEach((issue) => {
      const section = sectionFromValidation(issue.section);
      if (!section) {
        return;
      }
      warningsBySection.set(section, (warningsBySection.get(section) ?? 0) + 1);
    });

    const hasClass = Boolean(current.progression.classId);
    return sectionOrder.map((section) => {
      const pending = pendingBySection.get(section) ?? 0;
      const warnings = warningsBySection.get(section) ?? 0;
      const lockForClassDependent =
        !hasClass && ['proficiencies', 'features', 'spells', 'equipment', 'asi_feats', 'review'].includes(section);
      if (lockForClassDependent) {
        return {
          id: section,
          status: 'locked',
          pendingCount: 0
        };
      }
      if (warnings > 0) {
        return {
          id: section,
          status: 'warning',
          pendingCount: pending
        };
      }
      if (pending > 0) {
        return {
          id: section,
          status: 'needs_choices',
          pendingCount: pending
        };
      }
      return {
        id: section,
        status: 'complete',
        pendingCount: 0
      };
    });
  }, [derivedCharacter, editableCharacter]);

  const pendingForSection = useMemo(() => {
    const current = derivedCharacter ?? editableCharacter;
    if (!current) {
      return [] as PendingDecision[];
    }
    return current.validation.pendingDecisions.filter((decision) => sectionFromDecision(decision) === activeSection);
  }, [activeSection, derivedCharacter, editableCharacter]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
        Loading character builder...
      </section>
    );
  }

  if (error || !editableCharacter || !derivedCharacter) {
    return (
      <section className="rounded-xl border border-rose-600/40 bg-rose-950/20 p-4 text-sm text-rose-100">
        {error ?? 'Unable to load character.'}
      </section>
    );
  }

  const unresolvedCount = derivedCharacter.validation.pendingDecisions.length;
  const hasBlockingErrors = derivedCharacter.validation.errors.length > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Character Builder</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
              {derivedCharacter.meta.name || 'Unnamed Character'}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Level {derivedCharacter.progression.level} {rulesFacade.findClassName(derivedCharacter.progression.classId ?? '') ?? 'Class TBD'}
              {derivedCharacter.progression.subclassId
                ? ` (${rulesFacade.findSubclassName(derivedCharacter.progression.subclassId) ?? 'Subclass'})`
                : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-950/45 p-3 text-xs text-slate-200 sm:grid-cols-4">
            <p>AC: {derivedCharacter.derived.armorClass ?? '-'}</p>
            <p>HP: {derivedCharacter.derived.hitPointsMax ?? '-'}</p>
            <p>Init: {derivedCharacter.derived.initiative >= 0 ? '+' : ''}{derivedCharacter.derived.initiative}</p>
            <p>Prof: +{derivedCharacter.derived.proficiencyBonus}</p>
            <p className="col-span-2 sm:col-span-4">
              Unresolved choices: {unresolvedCount} {hasBlockingErrors ? '| Blocking errors present' : ''}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <BuilderSidebar items={sidebarItems} activeSection={activeSection} onSelectSection={setActiveSection} />

        <div className="space-y-4">
          <DecisionPanel decisions={pendingForSection} title={`${BUILDER_SECTION_LABELS[activeSection]} pending`} />

          {activeSection === 'basics' ? (
            <SectionCard
              title="Basics"
              description="Set your character identity, level, class, and subclass."
              explainerTitle="Why this step matters"
              explainerBody="Your class and level drive almost every downstream rule decision in the builder."
            >
              <BasicsStep
                character={editableCharacter}
                classes={classes}
                subclasses={subclasses}
                subclassRequired={runtime.subclassRequired}
                onNameChange={(value) =>
                  updateEditable((current) => ({
                    ...current,
                    meta: {
                      ...current.meta,
                      name: value
                    }
                  }))
                }
                onPlayerNameChange={(value) =>
                  updateEditable((current) => ({
                    ...current,
                    meta: {
                      ...current.meta,
                      playerName: value
                    }
                  }))
                }
                onLevelChange={(value) => updateEditable((current) => invalidateForLevelChange(current, value))}
                onClassChange={(classId) => updateEditable((current) => invalidateForClassChange(current, classId))}
                onSubclassChange={(subclassId) =>
                  updateEditable((current) => invalidateForSubclassChange(current, subclassId))
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'origin' ? (
            <SectionCard
              title="Origin"
              description="Choose origin mode, race/species, and background."
              explainerBody="Background and race/species choices feed proficiencies, speed, languages, and ability bonuses."
            >
              <OriginStep
                character={editableCharacter}
                races={races}
                backgrounds={backgrounds}
                onModeChange={(mode) => updateEditable((current) => invalidateForOriginModeChange(current, mode))}
                onRaceChange={(raceId) => updateEditable((current) => invalidateForRaceChange(current, raceId))}
                onBackgroundChange={(backgroundId) =>
                  updateEditable((current) => invalidateForBackgroundChange(current, backgroundId))
                }
                onLanguagesChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedLanguages: values
                    }
                  }))
                }
                onToolsChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedToolProficiencies: values
                    }
                  }))
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'ability_scores' ? (
            <SectionCard title="Ability Scores" description="Point buy + origin bonuses + ASI/feat effects.">
              <AbilityScoresStep
                character={derivedCharacter}
                onBaseScoreChange={(ability, next) =>
                  updateEditable((current) => ({
                    ...current,
                    abilities: {
                      ...current.abilities,
                      pointBuyBase: {
                        ...current.abilities.pointBuyBase,
                        [ability]: next
                      }
                    }
                  }))
                }
                onBackgroundAssignmentChange={(ability, value) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      backgroundBonusAssignments: {
                        ...(current.origin.backgroundBonusAssignments ?? {}),
                        [ability]: value
                      }
                    }
                  }))
                }
                onLegacyAssignmentChange={(ability, value) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      legacyRaceBonusAssignments: {
                        ...(current.origin.legacyRaceBonusAssignments ?? {}),
                        [ability]: value
                      }
                    }
                  }))
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'proficiencies' ? (
            <SectionCard title="Proficiencies" description="Resolve class skill picks and verify proficiencies.">
              <ProficienciesStep
                character={derivedCharacter}
                classSkillChoice={runtime.classSkillChoice}
                onSkillsChange={(skills) =>
                  updateEditable((current) => ({
                    ...current,
                    proficiencies: {
                      ...current.proficiencies,
                      skills
                    }
                  }))
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'features' ? (
            <SectionCard title="Features" description="Resolve dynamic feature choices from class and subclass data.">
              <FeaturesStep
                character={editableCharacter}
                featureChoices={runtime.featureChoices}
                onFeatureChoiceChange={(choiceId, selectedOptionIds) =>
                  updateEditable((current) => ({
                    ...current,
                    features: {
                      ...current.features,
                      selectedChoices: {
                        ...current.features.selectedChoices,
                        [choiceId]: selectedOptionIds
                      }
                    }
                  }))
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'spells' ? (
            <SectionCard title="Spells" description="Select cantrips, known spells, and prepared spells with live counters.">
              <SpellsStep
                character={editableCharacter}
                runtime={runtime}
                onCantripsChange={(next) =>
                  updateEditable((current) => ({
                    ...current,
                    spells: {
                      ...current.spells,
                      selectedCantrips: next
                    }
                  }))
                }
                onKnownSpellsChange={(next) =>
                  updateEditable((current) => ({
                    ...current,
                    spells: {
                      ...current.spells,
                      selectedKnownSpells: next
                    }
                  }))
                }
                onPreparedSpellsChange={(next) =>
                  updateEditable((current) => ({
                    ...current,
                    spells: {
                      ...current.spells,
                      preparedSpells: next
                    }
                  }))
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'equipment' ? (
            <SectionCard title="Equipment" description="Resolve class starting packages and inventory.">
              <EquipmentStep
                character={derivedCharacter}
                choices={runtime.equipmentChoices}
                onStartingModeChange={(mode) =>
                  updateEditable((current) => ({
                    ...current,
                    equipment: {
                      ...current.equipment,
                      startingMode: mode
                    }
                  }))
                }
                onSelectPackageOption={(decisionId, optionId) =>
                  updateEditable((current) => {
                    const choice = runtime.equipmentChoices.find((entry) => entry.id === decisionId);
                    const selectedOption = choice?.options.find((entry) => entry.id === optionId);
                    if (!choice || !selectedOption) {
                      return current;
                    }
                    const others = current.equipment.selectedPackages.filter((entry) => entry.decisionId !== decisionId);
                    return {
                      ...current,
                      equipment: {
                        ...current.equipment,
                        selectedPackages: [
                          ...others,
                          {
                            decisionId,
                            optionId,
                            label: selectedOption.label,
                            items: selectedOption.items
                          }
                        ]
                      }
                    };
                  })
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'asi_feats' ? (
            <SectionCard title="ASI / Feats" description="Resolve level-based ASI or feat opportunities.">
              <AsiFeatsStep
                character={editableCharacter}
                asiLevels={runtime.asiLevels}
                feats={rulesFacade.listFeats()}
                onSetAsiChoice={({ level, choice }) =>
                  updateEditable((current) => {
                    const others = current.featsAndAsi.opportunities.filter((entry) => entry.level !== level);
                    return {
                      ...current,
                      featsAndAsi: {
                        ...current.featsAndAsi,
                        opportunities: [...others, { level, choice }].sort((a, b) => a.level - b.level)
                      }
                    };
                  })
                }
              />
            </SectionCard>
          ) : null}

          {activeSection === 'review' ? (
            <SectionCard title="Review" description="Complete all remaining decisions before final export.">
              <div className="space-y-3">
                <p className="text-sm text-slate-200">
                  Current status: <span className="font-semibold">{derivedCharacter.status}</span>
                </p>
                <p className="text-sm text-slate-300">
                  Pending decisions: {derivedCharacter.validation.pendingDecisions.length} | Errors:{' '}
                  {derivedCharacter.validation.errors.length} | Warnings:{' '}
                  {derivedCharacter.validation.warnings.length}
                </p>
                {!props.hideReviewLink ? (
                  <Link
                    to={`/player/characters/${derivedCharacter.id}/review`}
                    className="inline-flex rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                  >
                    Open final review & export
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void forceSaveNow();
                  }}
                  className="inline-flex rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:border-sky-500"
                >
                  Save now
                </button>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
};
