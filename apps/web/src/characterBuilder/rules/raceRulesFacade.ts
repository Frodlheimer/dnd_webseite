import type { RaceEntryMeta, RaceStructuredData } from '../../rules/races/model';
import {
  getPlayableRaceMetas,
  getRaceDetail,
  getRaceMeta,
  getSubraceMetasForRace
} from '../../rules/races/api/racesData';
import type { Ability } from '../model/character';

export type CombinedRaceData = {
  id: string;
  name: string;
  raceId: string;
  subraceId: string | null;
  abilityBonuses: Partial<Record<Ability, number>>;
  abilityBonusChoice: RaceStructuredData['abilities']['bonusChoice'];
  languagesGranted: string[];
  languageChoices: RaceStructuredData['languages']['choices'];
  proficiencies: RaceStructuredData['proficiencies'];
  defenses: RaceStructuredData['defenses'];
  senses: RaceStructuredData['senses'];
  size: string | null;
  speed: {
    walk: number | null;
    burrow: number | null;
    climb: number | null;
    fly: number | null;
    swim: number | null;
  };
  traits: RaceStructuredData['traits'];
};

const dedupeStrings = (values: string[]): string[] => [...new Set(values)];

const mergeCountChoice = <T extends string>(
  left: { choose: number; from: T[] } | null | undefined,
  right: { choose: number; from: T[] } | null | undefined
): { choose: number; from: T[] } | null => {
  if (!left && !right) {
    return null;
  }
  if (!left) {
    return right ? { choose: right.choose, from: [...right.from] } : null;
  }
  if (!right) {
    return { choose: left.choose, from: [...left.from] };
  }
  return {
    choose: left.choose + right.choose,
    from: dedupeStrings([...left.from, ...right.from]) as T[]
  };
};

const mergeAbilityBonusChoice = (
  left: RaceStructuredData['abilities']['bonusChoice'],
  right: RaceStructuredData['abilities']['bonusChoice']
): RaceStructuredData['abilities']['bonusChoice'] => {
  if (!left && !right) {
    return null;
  }
  if (!left) {
    return right ? { choose: right.choose, amount: right.amount, from: [...right.from] } : null;
  }
  if (!right) {
    return { choose: left.choose, amount: left.amount, from: [...left.from] };
  }
  if (left.amount !== right.amount) {
    return { choose: right.choose, amount: right.amount, from: [...right.from] };
  }
  return {
    choose: left.choose + right.choose,
    amount: left.amount,
    from: dedupeStrings([...left.from, ...right.from]) as Ability[]
  };
};

const sumAbilityBonuses = (
  parent: Partial<Record<Ability, number>>,
  child: Partial<Record<Ability, number>>
): Partial<Record<Ability, number>> => {
  const output: Partial<Record<Ability, number>> = {
    ...parent
  };

  (Object.entries(child) as Array<[Ability, number]>).forEach(([ability, amount]) => {
    output[ability] = (output[ability] ?? 0) + amount;
  });

  return output;
};

const mergeRaceData = (
  race: RaceStructuredData,
  subrace: RaceStructuredData | null
): CombinedRaceData => {
  return {
    id: subrace?.id ?? race.id,
    name: subrace?.name ?? race.name,
    raceId: race.id,
    subraceId: subrace?.id ?? null,
    abilityBonuses: sumAbilityBonuses(race.abilities.bonuses, subrace?.abilities.bonuses ?? {}),
    abilityBonusChoice: mergeAbilityBonusChoice(race.abilities.bonusChoice, subrace?.abilities.bonusChoice ?? null),
    languagesGranted: dedupeStrings([...race.languages.granted, ...(subrace?.languages.granted ?? [])]),
    languageChoices: mergeCountChoice(race.languages.choices, subrace?.languages.choices),
    proficiencies: {
      armor: dedupeStrings([...race.proficiencies.armor, ...(subrace?.proficiencies.armor ?? [])]),
      weapons: dedupeStrings([...race.proficiencies.weapons, ...(subrace?.proficiencies.weapons ?? [])]),
      tools: dedupeStrings([...race.proficiencies.tools, ...(subrace?.proficiencies.tools ?? [])]),
      skills: dedupeStrings([...race.proficiencies.skills, ...(subrace?.proficiencies.skills ?? [])]),
      skillChoices: mergeCountChoice(race.proficiencies.skillChoices, subrace?.proficiencies.skillChoices),
      toolChoices: mergeCountChoice(race.proficiencies.toolChoices, subrace?.proficiencies.toolChoices)
    },
    defenses: {
      resistances: dedupeStrings([...race.defenses.resistances, ...(subrace?.defenses.resistances ?? [])]),
      immunities: dedupeStrings([...race.defenses.immunities, ...(subrace?.defenses.immunities ?? [])]),
      conditionImmunities: dedupeStrings([
        ...race.defenses.conditionImmunities,
        ...(subrace?.defenses.conditionImmunities ?? [])
      ]),
      savingThrowAdvantages: dedupeStrings([
        ...race.defenses.savingThrowAdvantages,
        ...(subrace?.defenses.savingThrowAdvantages ?? [])
      ])
    },
    senses: {
      darkvision: subrace?.senses.darkvision ?? race.senses.darkvision ?? null,
      blindsight: subrace?.senses.blindsight ?? race.senses.blindsight ?? null,
      tremorsense: subrace?.senses.tremorsense ?? race.senses.tremorsense ?? null,
      truesight: subrace?.senses.truesight ?? race.senses.truesight ?? null
    },
    size: subrace?.basics.size ?? race.basics.size ?? null,
    speed: {
      walk: subrace?.basics.speedWalk ?? race.basics.speedWalk ?? null,
      burrow: subrace?.basics.speedBurrow ?? race.basics.speedBurrow ?? null,
      climb: subrace?.basics.speedClimb ?? race.basics.speedClimb ?? null,
      fly: subrace?.basics.speedFly ?? race.basics.speedFly ?? null,
      swim: subrace?.basics.speedSwim ?? race.basics.speedSwim ?? null
    },
    traits: [...race.traits, ...(subrace?.traits ?? [])]
  };
};

export const raceRulesFacade = {
  listPlayableRaces(): RaceEntryMeta[] {
    return getPlayableRaceMetas().sort((left, right) => left.name.localeCompare(right.name));
  },

  async getRaceById(id: string): Promise<RaceStructuredData | null> {
    return await getRaceDetail(id);
  },

  getSubracesForRace(raceId: string): RaceEntryMeta[] {
    return getSubraceMetasForRace(raceId).sort((left, right) => left.name.localeCompare(right.name));
  },

  async getCombinedRaceData(raceId: string, subraceId: string | null): Promise<CombinedRaceData | null> {
    const raceMeta = getRaceMeta(raceId);
    if (!raceMeta || raceMeta.kind !== 'race') {
      return null;
    }

    const race = await getRaceDetail(raceId);
    if (!race) {
      return null;
    }

    if (!subraceId) {
      return mergeRaceData(race, null);
    }

    const validSubraceIds = new Set(this.getSubracesForRace(raceId).map((meta) => meta.id));
    if (!validSubraceIds.has(subraceId)) {
      return null;
    }

    const subrace = await getRaceDetail(subraceId);
    if (!subrace) {
      return null;
    }

    return mergeRaceData(race, subrace);
  }
};
