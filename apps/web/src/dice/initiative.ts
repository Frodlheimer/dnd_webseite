import { randomIntInclusive, randomUint32 } from './rng';

export type InitiativeParticipant = {
  name: string;
  count: number;
  initiativeMod: number;
  sourceNpcId?: string;
};

export type InitiativeRow = {
  id: string;
  name: string;
  baseName: string;
  d20: number;
  modifier: number;
  total: number;
  count: number;
  sourceNpcId?: string;
};

export type RollInitiativeOptions = {
  createIndividualEntries: boolean;
  globalModifier?: number;
  rollDie?: () => number;
};

const createInitiativeId = (): string => {
  return `init-${Date.now()}-${randomUint32().toString(16)}`;
};

const normalizeModifier = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value ?? 0);
};

const sanitizeCount = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value ?? 0));
};

const clampD20 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const truncated = Math.trunc(value);
  if (truncated < 1) {
    return 1;
  }
  if (truncated > 20) {
    return 20;
  }
  return truncated;
};

const initiativeSorter = (left: InitiativeRow, right: InitiativeRow): number => {
  if (right.total !== left.total) {
    return right.total - left.total;
  }
  if (right.d20 !== left.d20) {
    return right.d20 - left.d20;
  }
  return left.name.localeCompare(right.name);
};

export const rollInitiative = (
  participants: InitiativeParticipant[],
  options: RollInitiativeOptions
): InitiativeRow[] => {
  const rollDie = options.rollDie ?? (() => randomIntInclusive(1, 20));
  const globalModifier = normalizeModifier(options.globalModifier);
  const rows: InitiativeRow[] = [];

  for (const participant of participants) {
    const baseName = participant.name.trim();
    if (!baseName) {
      continue;
    }

    const count = sanitizeCount(participant.count);
    if (count <= 0) {
      continue;
    }

    const modifier = normalizeModifier(participant.initiativeMod) + globalModifier;
    if (options.createIndividualEntries) {
      for (let index = 0; index < count; index += 1) {
        const d20 = clampD20(rollDie());
        const row: InitiativeRow = {
          id: createInitiativeId(),
          name: count > 1 ? `${baseName} #${index + 1}` : baseName,
          baseName,
          d20,
          modifier,
          total: d20 + modifier,
          count: 1
        };
        if (participant.sourceNpcId) {
          row.sourceNpcId = participant.sourceNpcId;
        }
        rows.push(row);
      }
      continue;
    }

    const d20 = clampD20(rollDie());
    const groupedRow: InitiativeRow = {
      id: createInitiativeId(),
      name: count > 1 ? `${baseName} x${count}` : baseName,
      baseName,
      d20,
      modifier,
      total: d20 + modifier,
      count
    };
    if (participant.sourceNpcId) {
      groupedRow.sourceNpcId = participant.sourceNpcId;
    }
    rows.push(groupedRow);
  }

  return rows.sort(initiativeSorter);
};

export const formatInitiativeAsTsv = (rows: InitiativeRow[]): string => {
  const lines = ['Name\td20\tModifier\tTotal'];
  for (const row of rows) {
    const modifierLabel = row.modifier >= 0 ? `+${row.modifier}` : `${row.modifier}`;
    lines.push(`${row.name}\t${row.d20}\t${modifierLabel}\t${row.total}`);
  }
  return lines.join('\n');
};

export const formatInitiativeAsMarkdown = (rows: InitiativeRow[]): string => {
  const lines = ['| Name | d20 | Mod | Total |', '| --- | ---: | ---: | ---: |'];
  for (const row of rows) {
    const modifierLabel = row.modifier >= 0 ? `+${row.modifier}` : `${row.modifier}`;
    lines.push(`| ${row.name} | ${row.d20} | ${modifierLabel} | ${row.total} |`);
  }
  return lines.join('\n');
};
