import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { deriveCharacter, type DerivedCharacterRuntime } from '../engine/deriveCharacter';
import {
  invalidateForBackgroundChange,
  invalidateForClassChange,
  invalidateForLevelChange,
  invalidateForRaceChange,
  invalidateForRulesetChange,
  invalidateForSubraceChange,
  invalidateForSubclassChange
} from '../engine/choiceResolution';
import {
  isImplementedCharacterRuleset,
  type CharacterRecord,
  type PendingDecision
} from '../model/character';
import { BUILDER_SECTION_LABELS, builderSectionOrder, type BuilderSectionId } from '../model/decisions';
import { getRulesetContentPolicy } from '../rules/rulesetContentPolicy';
import { type BuilderBackground, type BuilderClassSummary, type BuilderRaceSummary, rulesFacade } from '../rules/rulesFacade';
import {
  getDefaultCharacterRuleset,
  setDefaultCharacterRuleset
} from '../settings/rulesetPreferences';
import { characterRepository } from '../storage/characterRepository';
import { calculatePointBuy } from '../pointBuy/rules';
import { BuilderSidebar, type BuilderSidebarItem } from './BuilderSidebar';
import {
  BuilderRuleReferenceModal,
  type BuilderRuleReference
} from './BuilderRuleReferenceModal';
import { DecisionPanel } from './DecisionPanel';
import { SectionCard } from './SectionCard';
import { AbilityScoresStep } from './steps/AbilityScoresStep';
import { AsiFeatsStep } from './steps/AsiFeatsStep';
import { BackgroundStep } from './steps/BackgroundStep';
import { BasicsStep } from './steps/BasicsStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { FeaturesStep } from './steps/FeaturesStep';
import { ProficienciesStep } from './steps/ProficienciesStep';
import { RaceStep } from './steps/RaceStep';
import { RulesetStep } from './steps/RulesetStep';
import { SpellsStep } from './steps/SpellsStep';

const defaultRuntime: DerivedCharacterRuntime = {
  classSkillChoice: {
    choose: 0,
    options: []
  },
  origin: {
    availableSubraces: [],
    raceLanguageChoices: 0,
    raceLanguageOptions: [],
    raceToolChoices: 0,
    raceToolOptions: [],
    raceSkillChoices: 0,
    raceSkillOptions: [],
    raceAbilityBonusChoice: null,
    backgroundLanguageChoices: 0,
    backgroundLanguageOptions: [],
    backgroundToolChoices: 0,
    backgroundToolOptions: [],
    backgroundSkillChoices: 0,
    backgroundSkillOptions: []
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

const sectionOrder: BuilderSectionId[] = builderSectionOrder;

const sectionFromDecision = (decision: PendingDecision): BuilderSectionId | null => {
  const normalized = decision.section.toLowerCase();
  if (normalized.includes('rule set') || normalized.includes('ruleset')) {
    return 'ruleset';
  }
  if (normalized.includes('basic')) {
    return 'basics';
  }
  if (normalized.includes('race')) {
    return 'race';
  }
  if (normalized.includes('background')) {
    return 'background';
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
    return 'ability_scores';
  }
  return null;
};

const sectionFromValidation = (section: string): BuilderSectionId | null => {
  const normalized = section.toLowerCase();
  if (normalized.includes('rule set') || normalized.includes('ruleset')) {
    return 'ruleset';
  }
  if (normalized.includes('basic')) {
    return 'basics';
  }
  if (normalized.includes('race')) {
    return 'race';
  }
  if (normalized.includes('background') || normalized.includes('origin')) {
    return 'background';
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
    return 'ability_scores';
  }
  return null;
};

const cloneCharacter = (character: CharacterRecord): CharacterRecord => structuredClone(character);

const toPointBuyBaseScores = (character: CharacterRecord) => ({
  STR: character.abilities.pointBuyBase.str,
  DEX: character.abilities.pointBuyBase.dex,
  CON: character.abilities.pointBuyBase.con,
  INT: character.abilities.pointBuyBase.int,
  WIS: character.abilities.pointBuyBase.wis,
  CHA: character.abilities.pointBuyBase.cha
});

const countRaceNeedsChoices = (
  character: CharacterRecord,
  originRuntime: DerivedCharacterRuntime['origin']
): number => {
  let count = 0;
  if (!character.origin.raceId && !character.origin.speciesId) {
    count += 1;
  }
  if (character.origin.raceId && originRuntime.availableSubraces.length > 0 && !character.origin.subraceId) {
    count += 1;
  }
  if (originRuntime.raceLanguageChoices > character.origin.selectedRaceLanguages.length) {
    count += 1;
  }
  if (originRuntime.raceToolChoices > character.origin.selectedRaceToolProficiencies.length) {
    count += 1;
  }
  if (originRuntime.raceSkillChoices > character.origin.selectedRaceSkills.length) {
    count += 1;
  }
  return count;
};

const countBackgroundNeedsChoices = (
  character: CharacterRecord,
  originRuntime: DerivedCharacterRuntime['origin']
): number => {
  let count = 0;
  if (!character.origin.backgroundId) {
    count += 1;
  }
  if (originRuntime.backgroundLanguageChoices > character.origin.selectedBackgroundLanguages.length) {
    count += 1;
  }
  if (originRuntime.backgroundToolChoices > character.origin.selectedBackgroundToolProficiencies.length) {
    count += 1;
  }
  if (originRuntime.backgroundSkillChoices > character.origin.selectedBackgroundSkills.length) {
    count += 1;
  }
  return count;
};

const countAbilityScoreNeedsChoices = (
  character: CharacterRecord,
  originRuntime: DerivedCharacterRuntime['origin'],
  asiLevels: number[]
): number => {
  let count = 0;
  const pointBuy = calculatePointBuy(toPointBuyBaseScores(character));
  if (pointBuy.remaining > 0) {
    count += 1;
  }

  const selectedRaceAbilityChoicesCount = originRuntime.raceAbilityBonusChoice
    ? originRuntime.raceAbilityBonusChoice.from.filter(
        (ability) => (character.origin.legacyRaceBonusAssignments?.[ability] ?? 0) > 0
      ).length
    : 0;

  if (
    originRuntime.raceAbilityBonusChoice &&
    selectedRaceAbilityChoicesCount < originRuntime.raceAbilityBonusChoice.choose
  ) {
    count += 1;
  }

  asiLevels
    .filter((level) => level <= character.progression.level)
    .forEach((level) => {
      const entry = character.featsAndAsi.opportunities.find((opportunity) => opportunity.level === level);
      if (!entry) {
        count += 1;
        return;
      }

      if (entry.choice.kind === 'ASI') {
        const assignedTotal = Object.values(entry.choice.increases).reduce((sum, value) => sum + (value ?? 0), 0);
        if (assignedTotal < 2) {
          count += 1;
        }
        return;
      }

      if (!entry.choice.featId) {
        count += 1;
        return;
      }

      const featMeta = rulesFacade.getFeatById(entry.choice.featId);
      const requiredBonusCount =
        featMeta?.quickFacts.abilityIncrease.mode === 'CHOICE'
          ? featMeta.quickFacts.abilityIncrease.amount
          : 0;
      if (requiredBonusCount > 0) {
        const assignedTotal = Object.values(entry.choice.bonusAssignments ?? {}).reduce(
          (sum, value) => sum + (value ?? 0),
          0
        );
        if (assignedTotal < requiredBonusCount) {
          count += 1;
        }
      }
    });

  return count;
};

const countSpellNeedsChoices = (
  character: CharacterRecord,
  spellLimits: DerivedCharacterRuntime['spellLimits']
): number => {
  let count = 0;
  if (spellLimits.cantripsKnown && character.spells.selectedCantrips.length < spellLimits.cantripsKnown) {
    count += 1;
  }
  if (
    spellLimits.isKnownSpellsCaster &&
    spellLimits.spellsKnown &&
    character.spells.selectedKnownSpells.length < spellLimits.spellsKnown
  ) {
    count += 1;
  }
  if (
    spellLimits.isPreparedCaster &&
    spellLimits.preparedMax &&
    character.spells.preparedSpells.length < spellLimits.preparedMax
  ) {
    count += 1;
  }
  return count;
};

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
  const [activeSection, setActiveSection] = useState<BuilderSectionId>(props.initialSection ?? 'ruleset');
  const [referenceModal, setReferenceModal] = useState<BuilderRuleReference | null>(null);
  const [defaultRuleset, setDefaultRulesetState] = useState(() => getDefaultCharacterRuleset());
  const [classes, setClasses] = useState<BuilderClassSummary[]>([]);
  const [races, setRaces] = useState<BuilderRaceSummary[]>([]);
  const [backgrounds, setBackgrounds] = useState<BuilderBackground[]>([]);
  const contentPolicy = useMemo(
    () => getRulesetContentPolicy(editableCharacter?.ruleset ?? defaultRuleset),
    [defaultRuleset, editableCharacter?.ruleset]
  );

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
    if (!isImplementedCharacterRuleset(editableCharacter.ruleset)) {
      setRaces([]);
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
  }, [editableCharacter?.origin.mode, editableCharacter?.ruleset]);

  useEffect(() => {
    if (!editableCharacter || !isImplementedCharacterRuleset(editableCharacter.ruleset)) {
      setClasses([]);
      setBackgrounds([]);
      return;
    }
    setClasses(rulesFacade.listPlayableClasses());
    setBackgrounds(rulesFacade.listBackgrounds().filter(contentPolicy.isBackgroundAllowed));
  }, [contentPolicy, editableCharacter?.ruleset]);

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

  const rulesetImplemented = editableCharacter
    ? isImplementedCharacterRuleset(editableCharacter.ruleset)
    : false;

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
      const explicitNeedsChoices =
        section === 'race'
          ? countRaceNeedsChoices(current, runtime.origin)
          : section === 'background'
            ? countBackgroundNeedsChoices(current, runtime.origin)
            : section === 'ability_scores'
              ? countAbilityScoreNeedsChoices(current, runtime.origin, runtime.asiLevels)
              : section === 'spells'
                ? countSpellNeedsChoices(current, runtime.spellLimits)
                : 0;
      const unresolved = Math.max(pending, explicitNeedsChoices);
      const lockForRulesetDependent = !isImplementedCharacterRuleset(current.ruleset) && section !== 'ruleset';
      if (lockForRulesetDependent) {
        return {
          id: section,
          status: 'locked',
          pendingCount: 0
        };
      }
      const lockForClassDependent =
        !hasClass && ['proficiencies', 'features', 'spells', 'equipment', 'review'].includes(section);
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
          pendingCount: unresolved
        };
      }
      if (unresolved > 0) {
        return {
          id: section,
          status: 'needs_choices',
          pendingCount: unresolved
        };
      }
      return {
        id: section,
        status: 'complete',
        pendingCount: 0
      };
    });
  }, [derivedCharacter, editableCharacter, runtime]);

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
  const activeSectionIndex = sectionOrder.indexOf(activeSection);
  const nextSection = activeSectionIndex >= 0 ? sectionOrder[activeSectionIndex + 1] ?? null : null;
  const showRulesetPlaceholder = !rulesetImplemented && activeSection !== 'ruleset';

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

          {activeSection === 'ruleset' ? (
            <SectionCard
              title="Rule Set"
              description="Choose the ruleset for this character and optionally make it the default for future characters."
              explainerTitle="Why this step matters"
              explainerBody="The selected ruleset defines which builder data pack and downstream rule assumptions apply."
            >
              <RulesetStep
                character={editableCharacter}
                defaultRuleset={defaultRuleset}
                contentPolicy={contentPolicy}
                availableCounts={{
                  classes: classes.length,
                  races: races.length,
                  backgrounds: backgrounds.length
                }}
                onRulesetChange={(ruleset) =>
                  updateEditable((current) => invalidateForRulesetChange(current, ruleset))
                }
                onDefaultRulesetChange={(ruleset) => {
                  setDefaultCharacterRuleset(ruleset);
                  setDefaultRulesetState(ruleset);
                }}
              />
            </SectionCard>
          ) : null}

          {showRulesetPlaceholder ? (
            <SectionCard
              title={BUILDER_SECTION_LABELS[activeSection]}
              description="DnD5.5 (SRD 5.2) is reserved for a future guided builder update."
              explainerTitle="Current status"
              explainerBody="The guided Character Builder currently supports the DnD5e (SRD 5.1) flow. Switch back in Rule Set to continue."
            >
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  This section is intentionally held as a placeholder until the DnD5.5 rules pack is implemented.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('ruleset')}
                  className="inline-flex rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                >
                  Back to Rule Set
                </button>
              </div>
            </SectionCard>
          ) : null}

          {!showRulesetPlaceholder && activeSection === 'basics' ? (
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
                onOpenClassReference={(classId) => setReferenceModal({ kind: 'class', id: classId })}
                onOpenSubclassReference={(subclassId) =>
                  setReferenceModal({ kind: 'subclass', id: subclassId })
                }
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

          {!showRulesetPlaceholder && activeSection === 'race' ? (
            <SectionCard
              title="Choose Race"
              description="Choose race, subrace, and race-granted selections."
              explainerBody="Race choices drive size, speed, senses, languages, traits, and some ability score bonuses."
            >
              <RaceStep
                character={editableCharacter}
                races={races}
                originRuntime={runtime.origin}
                onOpenRaceReference={(race) =>
                  setReferenceModal({
                    kind: race.sourceType === 'lineage' ? 'lineage' : 'race',
                    id: race.id
                  })
                }
                onOpenSubraceReference={(subraceId) =>
                  setReferenceModal({ kind: 'race', id: subraceId })
                }
                onRaceChange={(raceId) => updateEditable((current) => invalidateForRaceChange(current, raceId))}
                onSubraceChange={(subraceId) =>
                  updateEditable((current) => invalidateForSubraceChange(current, subraceId))
                }
                onRaceLanguagesChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedRaceLanguages: values
                    }
                  }))
                }
                onRaceToolsChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedRaceToolProficiencies: values
                    }
                  }))
                }
                onRaceSkillsChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedRaceSkills: values
                    }
                  }))
                }
              />
            </SectionCard>
          ) : null}

          {!showRulesetPlaceholder && activeSection === 'background' ? (
            <SectionCard
              title="Choose Background"
              description="Choose background and resolve its granted choice lists."
              explainerBody="Backgrounds feed proficiencies, languages, equipment, and feature text into the character."
            >
              <BackgroundStep
                character={editableCharacter}
                backgrounds={backgrounds}
                originRuntime={runtime.origin}
                onOpenBackgroundReference={(backgroundId) =>
                  setReferenceModal({ kind: 'background', id: backgroundId })
                }
                onBackgroundChange={(backgroundId) =>
                  updateEditable((current) => invalidateForBackgroundChange(current, backgroundId))
                }
                onBackgroundLanguagesChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedBackgroundLanguages: values
                    }
                  }))
                }
                onBackgroundToolsChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedBackgroundToolProficiencies: values
                    }
                  }))
                }
                onBackgroundSkillsChange={(values) =>
                  updateEditable((current) => ({
                    ...current,
                    origin: {
                      ...current.origin,
                      selectedBackgroundSkills: values
                    }
                  }))
                }
              />
            </SectionCard>
          ) : null}

          {!showRulesetPlaceholder && activeSection === 'ability_scores' ? (
            <SectionCard title="Ability Scores" description="Point buy, origin bonuses, and ASI / feat planning in one step.">
              <div className="space-y-4">
                <AbilityScoresStep
                  character={derivedCharacter}
                  originRuntime={runtime.origin}
                  asiLevels={runtime.asiLevels}
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
                  onRaceAssignmentChange={(ability, value) =>
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

                <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-slate-100">ASI / Feats</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      When your class grants an Ability Score Improvement, choose ASI to raise abilities directly or
                      choose a feat instead. These choices unlock only at the class levels that grant them.
                    </p>
                  </div>
                  <AsiFeatsStep
                    character={editableCharacter}
                    asiLevels={runtime.asiLevels}
                    feats={rulesFacade.listFeats()}
                    onOpenFeatReference={(featId) => setReferenceModal({ kind: 'feat', id: featId })}
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
                </section>
              </div>
            </SectionCard>
          ) : null}

          {!showRulesetPlaceholder && activeSection === 'proficiencies' ? (
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

          {!showRulesetPlaceholder && activeSection === 'features' ? (
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

          {!showRulesetPlaceholder && activeSection === 'spells' ? (
            <SectionCard title="Spells" description="Select cantrips, known spells, and prepared spells with live counters.">
              <SpellsStep
                character={editableCharacter}
                runtime={runtime}
                onOpenSpellReference={(slug) => setReferenceModal({ kind: 'spell', id: slug })}
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

          {!showRulesetPlaceholder && activeSection === 'equipment' ? (
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

          {!showRulesetPlaceholder && activeSection === 'review' ? (
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

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/55 p-4">
            <p className="text-sm text-slate-300">
              Step {activeSectionIndex + 1} of {sectionOrder.length}: {BUILDER_SECTION_LABELS[activeSection]}
            </p>
            <button
              type="button"
              disabled={!nextSection}
              onClick={() => {
                if (nextSection) {
                  setActiveSection(nextSection);
                }
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                nextSection
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  : 'cursor-not-allowed border border-slate-700 bg-slate-900/60 text-slate-500'
              }`}
            >
              {nextSection ? `Next: ${BUILDER_SECTION_LABELS[nextSection]}` : 'Final step'}
            </button>
          </section>
        </div>
      </div>

      {referenceModal ? (
        <BuilderRuleReferenceModal
          reference={referenceModal}
          onClose={() => setReferenceModal(null)}
        />
      ) : null}
    </div>
  );
};
