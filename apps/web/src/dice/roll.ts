import { randomIntInclusive, randomUint32 } from './rng';

export type DiceKind = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export type DiceSpec = {
  sides: DiceKind;
  qty: number;
};

export type RollResult = {
  id: string;
  ts: number;
  specs: DiceSpec[];
  rolls: Array<{
    sides: number;
    value: number;
  }>;
  total: number;
  modifier: number;
  totalWithModifier: number;
};

const createRollId = (): string => {
  return `roll-${Date.now()}-${randomUint32().toString(16)}`;
};

const normalizeModifier = (modifier: number | undefined): number => {
  if (!Number.isFinite(modifier)) {
    return 0;
  }
  return Math.trunc(modifier ?? 0);
};

export const createRollResult = (
  specs: DiceSpec[],
  rolls: RollResult['rolls'],
  modifier?: number
): RollResult => {
  const normalizedSpecs = specs
    .map((spec) => ({
      sides: spec.sides,
      qty: Math.max(0, Math.trunc(spec.qty))
    }))
    .filter((spec) => spec.qty > 0);

  const normalizedRolls = rolls
    .map((roll) => ({
      sides: Math.max(1, Math.trunc(roll.sides)),
      value: Math.max(1, Math.trunc(roll.value))
    }))
    .filter((roll) => Number.isFinite(roll.sides) && Number.isFinite(roll.value));

  const total = normalizedRolls.reduce((sum, die) => sum + die.value, 0);
  const normalizedModifier = normalizeModifier(modifier);

  return {
    id: createRollId(),
    ts: Date.now(),
    specs: normalizedSpecs,
    rolls: normalizedRolls,
    total,
    modifier: normalizedModifier,
    totalWithModifier: total + normalizedModifier
  };
};

export const rollDice = (specs: DiceSpec[], modifier?: number): RollResult => {
  const normalizedSpecs = specs
    .map((spec) => ({
      sides: spec.sides,
      qty: Math.max(0, Math.trunc(spec.qty))
    }))
    .filter((spec) => spec.qty > 0);

  const rolls: RollResult['rolls'] = [];
  for (const spec of normalizedSpecs) {
    for (let index = 0; index < spec.qty; index += 1) {
      rolls.push({
        sides: spec.sides,
        value: randomIntInclusive(1, spec.sides)
      });
    }
  }

  return createRollResult(normalizedSpecs, rolls, modifier);
};
