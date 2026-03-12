import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';

import { usePrefersReducedMotion } from '../components/landing/usePrefersReducedMotion';
import { useDiceAnimation } from '../dice/animation/useDiceAnimation';
import {
  DiceBoxTray,
  type DiceBoxPhysicsConfig,
  type DiceBoxRenderConfig,
  type DiceBoxTrayRef
} from '../dice3d/DiceBoxTray';
import {
  formatInitiativeAsMarkdown,
  formatInitiativeAsTsv,
  rollInitiative,
  type InitiativeParticipant,
  type InitiativeRow
} from '../dice/initiative';
import { createRollResult, rollDice, type DiceKind, type DiceSpec, type RollResult } from '../dice/roll';
import { DiceTray } from '../dice/ui/DiceTray';
import { npcsRepository, type Npc } from '../dm/npcs/npcsRepository';

const STANDARD_DICE: DiceKind[] = [4, 6, 8, 10, 12, 20, 100];
const MAX_QTY_PER_DIE = 50;
const MAX_HISTORY_ENTRIES = 50;
const MAX_HISTORY_FACES = 100;
const EDGE_CALIBRATION_TOP_BOTTOM = -2.6;
const EDGE_CALIBRATION_LEFT_RIGHT = -1.6;
const EDGE_CALIBRATION_PIXEL_FACTOR = 16;
const TRAY_BASE_MAX_WIDTH_PX = 790;

const STORAGE_KEYS = {
  animationMode: 'dice.animationMode',
  animate: 'dnd-vtt:dice:animate',
  totalMode: 'dnd-vtt:dice:totalMode',
  separateD20D100: 'dnd-vtt:dice:separateD20D100',
  specs: 'dnd-vtt:dice:specs',
  modifier: 'dnd-vtt:dice:modifier',
  history: 'dnd-vtt:dice:history',
  initiativeMode: 'dnd-vtt:dice:init:mode',
  quickGroups: 'dnd-vtt:dice:init:quickGroups',
  globalModifier: 'dnd-vtt:dice:init:globalModifier',
  createIndividual: 'dnd-vtt:dice:init:createIndividual',
  librarySelection: 'dnd-vtt:dice:init:librarySelection'
} as const;

type DiceSelection = Record<DiceKind, number>;

type GroupedDiceValues = {
  sides: number;
  values: number[];
};

type DiceHistoryEntry = {
  id: string;
  ts: number;
  notation: string;
  modifier: number;
  total: number;
  totalWithModifier: number;
  groupedRolls: GroupedDiceValues[];
  hiddenRollCount: number;
};

type QuickGroupDraft = {
  id: string;
  name: string;
  count: number;
  initiativeMod: number;
};

type InitiativeMode = 'quick' | 'library';
type AnimationMode = 'off' | '2d' | '3d';
type DiceTotalMode = 'all' | 'sameType';

type LibrarySelection = {
  selected: boolean;
  count: number;
  initiativeMod: number;
};

type LibrarySelectionMap = Record<string, LibrarySelection>;

type CopyState = 'idle' | 'copied' | 'failed';

const DEFAULT_QUICK_GROUPS: QuickGroupDraft[] = [
  {
    id: 'quick-group-1',
    name: 'Goblin',
    count: 4,
    initiativeMod: 2
  }
];

const createDefaultDiceSelection = (): DiceSelection => {
  return {
    4: 0,
    6: 0,
    8: 0,
    10: 0,
    12: 0,
    20: 0,
    100: 0
  };
};

const clampQuantity = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_QTY_PER_DIE, Math.trunc(value)));
};

const clampGroupCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(99, Math.trunc(value)));
};

const normalizeModifier = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
};

const parseIntegerInput = (value: string, fallback = 0): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const loadStoredJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveStoredJson = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const loadStoredBoolean = (key: string): boolean | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null;
};

const loadStoredString = (key: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const createQuickGroupId = (): string => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `quick-group-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

const createQuickGroup = (): QuickGroupDraft => {
  return {
    id: createQuickGroupId(),
    name: '',
    count: 1,
    initiativeMod: 0
  };
};

const ensureDiceSelection = (value: unknown): DiceSelection => {
  const fallback = createDefaultDiceSelection();
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const parsed = value as Partial<Record<DiceKind, number>>;
  for (const sides of STANDARD_DICE) {
    fallback[sides] = clampQuantity(parsed[sides] ?? 0);
  }
  return fallback;
};

const ensureQuickGroups = (value: unknown): QuickGroupDraft[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_QUICK_GROUPS;
  }

  const rows = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const draft = entry as Partial<QuickGroupDraft>;
      return {
        id: typeof draft.id === 'string' && draft.id.trim() ? draft.id : createQuickGroupId(),
        name: typeof draft.name === 'string' ? draft.name : '',
        count: clampGroupCount(draft.count ?? 0),
        initiativeMod: normalizeModifier(draft.initiativeMod ?? 0)
      } satisfies QuickGroupDraft;
    })
    .filter((entry): entry is QuickGroupDraft => entry !== null);

  return rows.length > 0 ? rows : DEFAULT_QUICK_GROUPS;
};

const ensureLibrarySelections = (value: unknown): LibrarySelectionMap => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const output: LibrarySelectionMap = {};
  for (const [id, selection] of Object.entries(value as Record<string, unknown>)) {
    if (!selection || typeof selection !== 'object') {
      continue;
    }
    const draft = selection as Partial<LibrarySelection>;
    output[id] = {
      selected: Boolean(draft.selected),
      count: clampGroupCount(draft.count ?? 1),
      initiativeMod: normalizeModifier(draft.initiativeMod ?? 0)
    };
  }
  return output;
};

const groupRollValues = (
  rolls: Array<{
    sides: number;
    value: number;
  }>
): GroupedDiceValues[] => {
  const map = new Map<number, number[]>();
  for (const roll of rolls) {
    const existing = map.get(roll.sides);
    if (existing) {
      existing.push(roll.value);
    } else {
      map.set(roll.sides, [roll.value]);
    }
  }

  return [...map.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([sides, values]) => ({ sides, values }));
};

const formatModifierLabel = (value: number): string => {
  return value >= 0 ? `+${value}` : `${value}`;
};

const buildDiceNotation = (specs: DiceSpec[], modifier: number): string => {
  const dicePart = specs.map((spec) => `${spec.qty}d${spec.sides}`).join(' + ');
  if (modifier === 0) {
    return dicePart;
  }
  return `${dicePart} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`;
};

const buildCompactRollSummary = (
  result: RollResult,
  totalMode: DiceTotalMode,
  separateD20D100: boolean
): string => {
  const notation = buildDiceNotation(result.specs, result.modifier);
  const preview = result.rolls.slice(0, MAX_HISTORY_FACES);
  const grouped = groupRollValues(preview)
    .map((entry) => `d${entry.sides}(${entry.values.join(', ')})`)
    .join(' ');
  const hidden = result.rolls.length - preview.length;
  const hiddenLabel = hidden > 0 ? ` +${hidden} more` : '';
  const display = computeRollDisplaySummary(result, totalMode, separateD20D100);
  if (display.primaryTotal !== null) {
    return `${notation}: ${grouped}${hiddenLabel} = ${display.primaryTotal}`;
  }

  const perType = [...display.perTypeTotals, ...display.specialTotals]
    .map((entry) => `d${entry.sides}:${entry.total}`)
    .join(' | ');
  return `${notation}: ${grouped}${hiddenLabel} => ${perType || 'no totals'}`;
};

const buildInitiativeParticipantsFromQuickGroups = (
  groups: QuickGroupDraft[]
): InitiativeParticipant[] => {
  return groups
    .map((group) => ({
      name: group.name.trim(),
      count: clampGroupCount(group.count),
      initiativeMod: normalizeModifier(group.initiativeMod)
    }))
    .filter((group) => group.name.length > 0 && group.count > 0);
};

const buildInitiativeParticipantsFromLibrary = (
  npcs: Npc[],
  selections: LibrarySelectionMap
): InitiativeParticipant[] => {
  const participants: InitiativeParticipant[] = [];
  for (const npc of npcs) {
    const selection = selections[npc.id];
    if (!selection?.selected) {
      continue;
    }
    participants.push({
      name: npc.name,
      count: clampGroupCount(selection.count),
      initiativeMod: normalizeModifier(selection.initiativeMod),
      sourceNpcId: npc.id
    });
  }
  return participants.filter((entry) => entry.count > 0);
};

const copyText = async (text: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('Copy command failed.');
  }
};

const setTransientCopyState = (
  setter: Dispatch<SetStateAction<CopyState>>,
  state: CopyState
): void => {
  setter(state);
  window.setTimeout(() => {
    setter('idle');
  }, 1500);
};

const buildHistoryEntry = (result: RollResult): DiceHistoryEntry => {
  const preview = result.rolls.slice(0, MAX_HISTORY_FACES);
  return {
    id: result.id,
    ts: result.ts,
    notation: buildDiceNotation(result.specs, result.modifier),
    modifier: result.modifier,
    total: result.total,
    totalWithModifier: result.totalWithModifier,
    groupedRolls: groupRollValues(preview),
    hiddenRollCount: Math.max(0, result.rolls.length - preview.length)
  };
};

const formatHistoryTimestamp = (timestamp: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp);
};

const buildAnimationDuration = (diceCount: number): number => {
  const base = 650;
  const extension = Math.min(250, diceCount * 6);
  return base + extension;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

type DiceTypeTotals = {
  sides: number;
  total: number;
  count: number;
};

type RollDisplaySummary = {
  primaryTotal: number | null;
  baseTotal: number | null;
  modifier: number;
  perTypeTotals: DiceTypeTotals[];
  specialTotals: DiceTypeTotals[];
};

const computeRollDisplaySummary = (
  result: RollResult,
  totalMode: DiceTotalMode,
  separateD20D100: boolean
): RollDisplaySummary => {
  const grouped = groupRollValues(result.rolls).map((entry) => ({
    sides: entry.sides,
    total: entry.values.reduce((sum, value) => sum + value, 0),
    count: entry.values.length
  }));

  const specialSet = new Set([20, 100]);
  const specialTotals = separateD20D100 ? grouped.filter((entry) => specialSet.has(entry.sides)) : [];
  const normalTotals = separateD20D100 ? grouped.filter((entry) => !specialSet.has(entry.sides)) : grouped;

  if (totalMode === 'sameType') {
    return {
      primaryTotal: null,
      baseTotal: null,
      modifier: result.modifier,
      perTypeTotals: normalTotals,
      specialTotals
    };
  }

  const baseTotal = normalTotals.reduce((sum, entry) => sum + entry.total, 0);
  return {
    primaryTotal: baseTotal + result.modifier,
    baseTotal,
    modifier: result.modifier,
    perTypeTotals: normalTotals,
    specialTotals
  };
};

const resolve3dLayout = (
  diceCount: number,
  viewportWidth: number,
  viewportHeight: number
): { height: number; scale: number } => {
  const safeDiceCount = Math.max(1, Math.trunc(diceCount));
  const safeViewportWidth = Math.max(320, Math.trunc(viewportWidth));
  const safeViewportHeight = Math.max(360, Math.trunc(viewportHeight));

  let baseHeight = 240;
  if (safeDiceCount > 6) {
    baseHeight = 275;
  }
  if (safeDiceCount > 12) {
    baseHeight = 305;
  }
  if (safeDiceCount > 24) {
    baseHeight = 340;
  }

  const viewportCap = clamp(Math.round(safeViewportHeight * 0.5), 230, 460);
  const mobileCap = safeViewportWidth < 640 ? 340 : viewportCap;
  let height = Math.min(baseHeight, mobileCap);
  if (safeDiceCount > 20) {
    height = Math.min(height + 26, mobileCap);
  }

  let scale = 14;
  if (safeDiceCount > 4) {
    scale = 12;
  }
  if (safeDiceCount > 8) {
    scale = 10;
  }
  if (safeDiceCount > 16) {
    scale = 9;
  }
  if (safeDiceCount > 30) {
    scale = 8;
  }
  if (safeViewportWidth < 900) {
    scale -= 1;
  }

  return {
    height,
    scale: clamp(scale, 6, 16)
  };
};

const resolve3dPhysicsConfig = (
  diceCount: number,
  viewportWidth: number,
  viewportHeight: number,
  cinematicActive: boolean
): DiceBoxPhysicsConfig => {
  const safeDiceCount = Math.max(1, Math.trunc(diceCount));
  const compactViewport = viewportWidth < 960;
  const shortViewport = viewportHeight < 760;
  const wideViewport = viewportWidth > 1500;
  const ultraWideViewport = viewportWidth > 1850;

  let size = 9.6;
  if (safeDiceCount > 6) {
    size = 10.1;
  }
  if (safeDiceCount > 12) {
    size = 10.8;
  }
  if (safeDiceCount > 22) {
    size = 11.4;
  }
  if (compactViewport) {
    size -= 0.35;
  }
  if (shortViewport) {
    size -= 0.2;
  }
  if (wideViewport) {
    size += 0.35;
  }
  if (ultraWideViewport) {
    size += 0.35;
  }

  let startingHeight = 10.2;
  if (safeDiceCount > 10) {
    startingHeight = 10.8;
  }
  if (safeDiceCount > 22) {
    startingHeight = 11.4;
  }

  let throwForce = 3.1;
  if (safeDiceCount > 10) {
    throwForce = 3.35;
  }
  if (safeDiceCount > 22) {
    throwForce = 3.55;
  }
  if (compactViewport) {
    throwForce -= 0.15;
  }
  if (shortViewport) {
    throwForce -= 0.1;
  }

  let spinForce = 4.3;
  if (safeDiceCount > 10) {
    spinForce = 4.6;
  }
  if (safeDiceCount > 22) {
    spinForce = 4.9;
  }

  let delay = 95;
  if (safeDiceCount > 10) {
    delay = 72;
  }
  if (safeDiceCount > 24) {
    delay = 48;
  }
  if (shortViewport) {
    delay += 8;
  }

  if (cinematicActive) {
    startingHeight += 0.5;
    throwForce -= 0.35;
    spinForce -= 0.15;
    delay += 35;
  }

  return {
    size: clamp(size, 8.8, 14.2),
    startingHeight: clamp(startingHeight, 8.5, 13.5),
    throwForce: clamp(throwForce, 2.2, 4.5),
    spinForce: clamp(spinForce, 3.4, 6.2),
    delay: clamp(delay, 25, 180),
    gravity: 1.04,
    mass: 1.08,
    friction: 0.62,
    restitution: 0.12,
    linearDamping: 0.44,
    angularDamping: 0.32,
    settleTimeout: 7600
  };
};

const resolve3dRenderConfig = (): DiceBoxRenderConfig => {
  return {
    lightIntensity: 1.3,
    shadowTransparency: 0.5,
    enableShadows: true
  };
};

const clampD20 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const normalized = Math.trunc(value);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > 20) {
    return 20;
  }
  return normalized;
};

const normalizeAnimationMode = (value: string | null | undefined): AnimationMode | null => {
  if (value === 'off' || value === '2d' || value === '3d') {
    return value;
  }
  return null;
};

const resolveInitialAnimationMode = (
  prefersReducedMotion: boolean,
  storedMode: string | null,
  legacyAnimatePreference: boolean | null
): AnimationMode => {
  const normalizedStored = normalizeAnimationMode(storedMode);
  if (normalizedStored) {
    return normalizedStored;
  }

  if (legacyAnimatePreference !== null) {
    return legacyAnimatePreference ? '2d' : 'off';
  }

  return prefersReducedMotion ? 'off' : '2d';
};

const buildDiceBoxNotation = (spec: DiceSpec): string => {
  return `${spec.qty}d${spec.sides}`;
};

export const DiceRoute = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const diceBoxTrayRef = useRef<DiceBoxTrayRef | null>(null);
  const storedAnimationMode = useMemo(() => loadStoredString(STORAGE_KEYS.animationMode), []);
  const storedAnimatePreference = useMemo(() => loadStoredBoolean(STORAGE_KEYS.animate), []);
  const [animationMode, setAnimationMode] = useState<AnimationMode>(() =>
    resolveInitialAnimationMode(prefersReducedMotion, storedAnimationMode, storedAnimatePreference)
  );
  const [dice3dSupported, setDice3dSupported] = useState<boolean | null>(null);
  const [dice3dReady, setDice3dReady] = useState(false);
  const [dice3dNotice, setDice3dNotice] = useState<string | null>(null);
  const [isRolling3d, setIsRolling3d] = useState(false);
  const [trayDiceCount, setTrayDiceCount] = useState(1);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight
  }));
  const is3dMode = animationMode === '3d';
  const cinematic3d = is3dMode;
  const is2dMode = animationMode === '2d';
  const [diceSelection, setDiceSelection] = useState<DiceSelection>(() =>
    ensureDiceSelection(loadStoredJson(STORAGE_KEYS.specs, createDefaultDiceSelection()))
  );
  const [diceTotalMode, setDiceTotalMode] = useState<DiceTotalMode>(() =>
    loadStoredJson<DiceTotalMode>(STORAGE_KEYS.totalMode, 'all')
  );
  const [separateD20D100, setSeparateD20D100] = useState<boolean>(() =>
    Boolean(loadStoredJson(STORAGE_KEYS.separateD20D100, false))
  );
  const [modifier, setModifier] = useState<number>(() =>
    normalizeModifier(loadStoredJson(STORAGE_KEYS.modifier, 0))
  );
  const [history, setHistory] = useState<DiceHistoryEntry[]>([]);
  const [latestRollResult, setLatestRollResult] = useState<RollResult | null>(null);
  const [diceError, setDiceError] = useState<string | null>(null);
  const [rollCopyState, setRollCopyState] = useState<CopyState>('idle');
  const [initiativeCopyState, setInitiativeCopyState] = useState<CopyState>('idle');

  const [initiativeMode, setInitiativeMode] = useState<InitiativeMode>(() =>
    loadStoredJson<InitiativeMode>(STORAGE_KEYS.initiativeMode, 'quick')
  );
  const [quickGroups, setQuickGroups] = useState<QuickGroupDraft[]>(() =>
    ensureQuickGroups(loadStoredJson(STORAGE_KEYS.quickGroups, DEFAULT_QUICK_GROUPS))
  );
  const [globalInitiativeModifier, setGlobalInitiativeModifier] = useState<number>(() =>
    normalizeModifier(loadStoredJson(STORAGE_KEYS.globalModifier, 0))
  );
  const [createIndividualEntries, setCreateIndividualEntries] = useState<boolean>(() =>
    Boolean(loadStoredJson(STORAGE_KEYS.createIndividual, true))
  );
  const [librarySelections, setLibrarySelections] = useState<LibrarySelectionMap>(() =>
    ensureLibrarySelections(loadStoredJson(STORAGE_KEYS.librarySelection, {}))
  );
  const [librarySearch, setLibrarySearch] = useState('');
  const [initiativeResults, setInitiativeResults] = useState<InitiativeRow[]>([]);
  const [initiativeError, setInitiativeError] = useState<string | null>(null);

  const [libraryNpcs, setLibraryNpcs] = useState<Npc[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const { animatedRolls, isAnimating, setAnimatedRolls, startAnimation } = useDiceAnimation(
    is2dMode
  );

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.animationMode, animationMode);
    saveStoredJson(STORAGE_KEYS.animate, animationMode === '2d');
  }, [animationMode]);

  useEffect(() => {
    if (!is3dMode) {
      setIsRolling3d(false);
    }
  }, [is3dMode]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.specs, diceSelection);
  }, [diceSelection]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.totalMode, diceTotalMode);
  }, [diceTotalMode]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.separateD20D100, separateD20D100);
  }, [separateD20D100]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.modifier, modifier);
  }, [modifier]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.history, history);
  }, [history]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.initiativeMode, initiativeMode);
  }, [initiativeMode]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.quickGroups, quickGroups);
  }, [quickGroups]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.globalModifier, globalInitiativeModifier);
  }, [globalInitiativeModifier]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.createIndividual, createIndividualEntries);
  }, [createIndividualEntries]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.librarySelection, librarySelections);
  }, [librarySelections]);

  useEffect(() => {
    let cancelled = false;
    setLibraryLoading(true);
    void npcsRepository
      .listNpcs()
      .then((npcs) => {
        if (cancelled) {
          return;
        }
        setLibraryNpcs(npcs);
        setLibraryError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load NPC library.';
        setLibraryError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLibraryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRolls = animatedRolls.length > 0 ? animatedRolls : latestRollResult?.rolls ?? [];
  const groupedVisibleRolls = useMemo(() => groupRollValues(visibleRolls), [visibleRolls]);
  const trayFacePreview = useMemo(() => {
    if (!latestRollResult || !is3dMode) {
      return [];
    }

    return latestRollResult.rolls.slice(0, 24).map((roll, index) => ({
      key: `${index}-${roll.sides}-${roll.value}`,
      sides: roll.sides,
      value: roll.value
    }));
  }, [is3dMode, latestRollResult]);
  const trayFacePreviewHiddenCount = useMemo(() => {
    if (!latestRollResult || !is3dMode) {
      return 0;
    }
    return Math.max(0, latestRollResult.rolls.length - 24);
  }, [is3dMode, latestRollResult]);
  const latestRollDisplay = useMemo(() => {
    if (!latestRollResult) {
      return null;
    }
    return computeRollDisplaySummary(latestRollResult, diceTotalMode, separateD20D100);
  }, [diceTotalMode, latestRollResult, separateD20D100]);
  const selectedDiceCount = useMemo(() => {
    return STANDARD_DICE.reduce((sum, sides) => sum + diceSelection[sides], 0);
  }, [diceSelection]);

  const filteredNpcs = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) {
      return libraryNpcs;
    }

    return libraryNpcs.filter((npc) => npc.name.toLowerCase().includes(query));
  }, [libraryNpcs, librarySearch]);

  const selectedDiceTypeCount = useMemo(() => {
    return STANDARD_DICE.filter((sides) => diceSelection[sides] > 0).length;
  }, [diceSelection]);

  const fallbackAnimationMode: AnimationMode = prefersReducedMotion ? 'off' : '2d';
  const is3dUnavailable = dice3dSupported === false;
  const { height: trayHeightPx, scale: trayScale } = useMemo(
    () => resolve3dLayout(trayDiceCount, viewportSize.width, viewportSize.height),
    [trayDiceCount, viewportSize.height, viewportSize.width]
  );
  const trayPhysicsConfig = useMemo(
    () =>
      resolve3dPhysicsConfig(trayDiceCount, viewportSize.width, viewportSize.height, cinematic3d),
    [cinematic3d, trayDiceCount, viewportSize.height, viewportSize.width]
  );
  const calibratedTrayHeightPx = useMemo(() => {
    const verticalAdjustmentPx = Math.round(
      EDGE_CALIBRATION_TOP_BOTTOM * EDGE_CALIBRATION_PIXEL_FACTOR
    );
    return clamp(trayHeightPx + verticalAdjustmentPx, 180, 480);
  }, [trayHeightPx]);
  const calibratedTrayMaxWidthPx = useMemo(() => {
    const horizontalAdjustmentPx = Math.round(
      EDGE_CALIBRATION_LEFT_RIGHT * EDGE_CALIBRATION_PIXEL_FACTOR
    );
    return clamp(TRAY_BASE_MAX_WIDTH_PX + horizontalAdjustmentPx, 360, 920);
  }, []);
  const trayRenderConfig = useMemo(() => resolve3dRenderConfig(), []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handle3dTrayReadyChange = useCallback((ready: boolean) => {
    setDice3dReady(ready);
    if (ready) {
      setDice3dSupported(true);
      setDice3dNotice(null);
    }
  }, []);

  const handle3dTrayError = useCallback(
    (error: Error) => {
      setDice3dSupported(false);
      setDice3dReady(false);
      setDice3dNotice(
        `3D dice are unavailable in this environment (${error.message}). Switched to ${
          fallbackAnimationMode === 'off' ? 'Off' : '2D'
        } mode.`
      );
      setAnimationMode(fallbackAnimationMode);
    },
    [fallbackAnimationMode]
  );

  const applyAnimationMode = useCallback(
    (nextMode: AnimationMode) => {
      if (nextMode === '3d' && is3dUnavailable) {
        setDice3dNotice('3D dice are unavailable on this device/browser.');
        setAnimationMode(fallbackAnimationMode);
        return;
      }
      setDice3dNotice(null);
      setAnimationMode(nextMode);
    },
    [fallbackAnimationMode, is3dUnavailable]
  );

  const handleAnimationModeChange = (value: string) => {
    const normalized = normalizeAnimationMode(value);
    if (!normalized) {
      return;
    }
    applyAnimationMode(normalized);
  };

  const handleDismiss3dNotice = () => {
    setDice3dNotice(null);
  };

  const handleRollDice = async () => {
    const specs = STANDARD_DICE.map((sides) => ({
      sides,
      qty: diceSelection[sides]
    })).filter((spec) => spec.qty > 0) as DiceSpec[];

    if (specs.length === 0) {
      setDiceError('Select at least one die before rolling.');
      return;
    }

    setDiceError(null);
    if (is3dMode) {
      setTrayDiceCount(selectedDiceCount);
      const tray = diceBoxTrayRef.current;
      if (!tray || !tray.isReady()) {
        setDiceError('3D dice tray is still loading. Please wait a moment and try again.');
        return;
      }

      try {
        const rolls: RollResult['rolls'] = [];
        if (specs.length === 1) {
          const [singleSpec] = specs;
          if (!singleSpec) {
            return;
          }
          const dieResults = await tray.roll(buildDiceBoxNotation(singleSpec));
          const faces = dieResults.slice(0, singleSpec.qty).map((die) => ({
            sides: singleSpec.sides,
            value: Math.max(1, Math.trunc(die.value))
          }));
          rolls.push(...faces);
        } else {
          const batchNotations = specs.map((spec) => buildDiceBoxNotation(spec));
          const batchResults = await tray.rollMany(batchNotations);
          for (const [index, spec] of specs.entries()) {
            const dieResults = batchResults[index] ?? [];
            const faces = dieResults.slice(0, spec.qty).map((die) => ({
              sides: spec.sides,
              value: Math.max(1, Math.trunc(die.value))
            }));
            rolls.push(...faces);
          }
        }

        const result = createRollResult(specs, rolls, modifier);
        setLatestRollResult(result);
        setAnimatedRolls(result.rolls);
        setHistory((previous) =>
          [buildHistoryEntry(result), ...previous].slice(0, MAX_HISTORY_ENTRIES)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown 3D roll error.';
        setDiceError(`3D roll failed: ${message}`);
      }
      return;
    }

    const result = rollDice(specs, modifier);
    setLatestRollResult(result);
    setAnimatedRolls(result.rolls);
    if (is2dMode) {
      startAnimation(result.rolls, buildAnimationDuration(result.rolls.length));
    }
    setHistory((previous) => [buildHistoryEntry(result), ...previous].slice(0, MAX_HISTORY_ENTRIES));
  };

  const handleCopyRoll = async () => {
    if (!latestRollResult) {
      return;
    }

    try {
      await copyText(buildCompactRollSummary(latestRollResult, diceTotalMode, separateD20D100));
      setTransientCopyState(setRollCopyState, 'copied');
    } catch {
      setTransientCopyState(setRollCopyState, 'failed');
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleQuickGroupFieldUpdate = (
    groupId: string,
    field: 'name' | 'count' | 'initiativeMod',
    value: string
  ) => {
    setQuickGroups((previous) =>
      previous.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        if (field === 'name') {
          return {
            ...group,
            name: value
          };
        }

        if (field === 'count') {
          return {
            ...group,
            count: clampGroupCount(parseIntegerInput(value))
          };
        }

        return {
          ...group,
          initiativeMod: normalizeModifier(parseIntegerInput(value))
        };
      })
    );
  };

  const handleLibrarySelectionChange = (
    npcId: string,
    patch: Partial<LibrarySelection>
  ): void => {
    setLibrarySelections((previous) => {
      const existing = previous[npcId] ?? {
        selected: false,
        count: 1,
        initiativeMod: 0
      };
      return {
        ...previous,
        [npcId]: {
          selected: patch.selected ?? existing.selected,
          count: clampGroupCount(patch.count ?? existing.count),
          initiativeMod: normalizeModifier(patch.initiativeMod ?? existing.initiativeMod)
        }
      };
    });
  };

  const handleRollInitiative = async () => {
    const participants =
      initiativeMode === 'quick'
        ? buildInitiativeParticipantsFromQuickGroups(quickGroups)
        : buildInitiativeParticipantsFromLibrary(libraryNpcs, librarySelections);

    if (participants.length === 0) {
      setInitiativeError('Add at least one participant before rolling initiative.');
      setInitiativeResults([]);
      return;
    }

    setInitiativeError(null);
    if (is3dMode) {
      const largestBatch = createIndividualEntries
        ? Math.max(...participants.map((participant) => participant.count), 1)
        : 1;
      setTrayDiceCount(largestBatch);
      const tray = diceBoxTrayRef.current;
      if (!tray || !tray.isReady()) {
        setInitiativeError('3D dice tray is still loading. Please wait a moment and try again.');
        setInitiativeResults([]);
        return;
      }

      try {
        const queue: number[] = [];
        for (const participant of participants) {
          const count = createIndividualEntries ? participant.count : 1;
          if (count <= 0) {
            continue;
          }
          const results = await tray.roll(`${count}d20`);
          queue.push(...results.slice(0, count).map((roll) => clampD20(roll.value)));
        }

        let cursor = 0;
        const rows = rollInitiative(participants, {
          createIndividualEntries,
          globalModifier: globalInitiativeModifier,
          rollDie: () => {
            const value = queue[cursor];
            cursor += 1;
            return value ?? 1;
          }
        });
        setInitiativeResults(rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown 3D roll error.';
        setInitiativeError(`3D initiative roll failed: ${message}`);
        setInitiativeResults([]);
      }
      return;
    }

    const rows = rollInitiative(participants, {
      createIndividualEntries,
      globalModifier: globalInitiativeModifier
    });
    setInitiativeResults(rows);
  };

  const handleCopyInitiativeTable = async () => {
    if (initiativeResults.length === 0) {
      return;
    }

    const payload = [
      'TSV',
      formatInitiativeAsTsv(initiativeResults),
      '',
      'Markdown',
      formatInitiativeAsMarkdown(initiativeResults)
    ].join('\n');

    try {
      await copyText(payload);
      setTransientCopyState(setInitiativeCopyState, 'copied');
    } catch {
      setTransientCopyState(setInitiativeCopyState, 'failed');
    }
  };

  return (
    <section className="grid gap-5">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Out-of-game tool</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dice</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Roll multiple dice, run initiative for NPC groups, and copy results instantly. All
              processing is client-side only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Animation mode
              </span>
              <select
                aria-label="Animation mode"
                value={animationMode}
                onChange={(event) => handleAnimationModeChange(event.target.value)}
                className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="off">Off</option>
                <option value="2d">2D</option>
                <option value="3d">3D</option>
              </select>
            </label>

            <button
              type="button"
              onClick={handleClearHistory}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
            >
              Clear history
            </button>
          </div>
        </div>

        {dice3dNotice ? (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-950/25 px-3 py-2 text-sm text-amber-200">
            <p>{dice3dNotice}</p>
            <button
              type="button"
              onClick={handleDismiss3dNotice}
              className="rounded border border-amber-300/40 px-2 py-1 text-xs text-amber-100 transition hover:border-amber-200/70"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">Multi Dice Roller</h2>
        <p className="mt-1 text-sm text-slate-300">
          Choose dice quantities, apply an optional modifier, and roll all dice at once.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {STANDARD_DICE.map((sides) => (
            <label
              key={`dice-${sides}`}
              className="rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-sm text-slate-300"
            >
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">d{sides}</span>
              <input
                type="number"
                min={0}
                max={MAX_QTY_PER_DIE}
                value={diceSelection[sides]}
                onChange={(event) => {
                  const nextValue = clampQuantity(parseIntegerInput(event.target.value));
                  setDiceSelection((previous) => ({
                    ...previous,
                    [sides]: nextValue
                  }));
                }}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="w-full max-w-40 text-sm text-slate-300">
            Modifier
            <input
              type="number"
              value={modifier}
              onChange={(event) => setModifier(normalizeModifier(parseIntegerInput(event.target.value)))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>

          <label className="w-full max-w-56 text-sm text-slate-300">
            Total mode
            <select
              value={diceTotalMode}
              onChange={(event) => {
                const nextMode = event.target.value === 'sameType' ? 'sameType' : 'all';
                setDiceTotalMode(nextMode);
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            >
              <option value="all">Add all dice</option>
              <option value="sameType">Add same dice only</option>
            </select>
          </label>

          <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={separateD20D100}
              onChange={(event) => setSeparateD20D100(event.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-sky-400"
            />
            Separate d20 / d100
          </label>

          <button
            type="button"
            onClick={handleRollDice}
            disabled={isRolling3d}
            className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            {isRolling3d ? 'Rolling...' : 'Roll'}
          </button>

          <button
            type="button"
            onClick={() =>
              setDiceSelection({
                4: 0,
                6: 0,
                8: 0,
                10: 0,
                12: 0,
                20: 1,
                100: 0
              })
            }
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 transition hover:border-slate-500"
          >
            Quick d20
          </button>

          <div className="text-sm text-slate-300">
            Selected dice: <span className="font-semibold text-slate-100">{selectedDiceCount}</span>
          </div>
        </div>

        {diceError ? (
          <p className="mt-3 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {diceError}
          </p>
        ) : null}

        {is3dMode ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">3D Dice Tray</p>
              <p className="text-xs text-slate-400">
                {dice3dReady
                  ? isRolling3d
                    ? 'Rolling in 3D...'
                    : 'Ready'
                  : 'Initializing...'}
              </p>
            </div>
            <div
              className="relative mx-auto w-full rounded-[1.1rem] bg-[conic-gradient(from_140deg_at_50%_50%,rgba(56,189,248,0.55),rgba(14,116,144,0.35),rgba(2,6,23,0.9),rgba(56,189,248,0.55))] p-[1px] shadow-[0_12px_36px_rgba(2,132,199,0.16)]"
              style={{
                maxWidth: `${calibratedTrayMaxWidthPx}px`
              }}
            >
              <div className="relative overflow-hidden rounded-[1rem] border border-sky-900/60 bg-slate-950/70">
                <div className="pointer-events-none absolute inset-0 rounded-[0.98rem] ring-1 ring-sky-400/15" />
                <DiceBoxTray
                  ref={diceBoxTrayRef}
                  enabled={is3dMode}
                  diceScale={trayScale}
                  physicsConfig={trayPhysicsConfig}
                  renderConfig={trayRenderConfig}
                  onReadyChange={handle3dTrayReadyChange}
                  onError={handle3dTrayError}
                  onRollingChange={setIsRolling3d}
                  className="relative z-[1] w-full"
                  style={{
                    height: `${calibratedTrayHeightPx}px`
                  }}
                />
                {trayFacePreview.length > 0 && !isRolling3d ? (
                  <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex flex-wrap justify-center gap-2">
                    {trayFacePreview.map((entry) => (
                      <div
                        key={entry.key}
                        className="rounded-md border border-sky-500/70 bg-slate-950/90 px-2 py-1 text-[11px] font-semibold text-sky-100 shadow-[0_0_0_1px_rgba(2,6,23,0.5)]"
                      >
                        d{entry.sides}: {entry.value}
                      </div>
                    ))}
                    {trayFacePreviewHiddenCount > 0 ? (
                      <div className="rounded-md border border-slate-600 bg-slate-950/85 px-2 py-1 text-[11px] font-medium text-slate-300">
                        +{trayFacePreviewHiddenCount} more
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {selectedDiceTypeCount > 1 ? (
              <p className="mt-3 text-xs text-slate-400">
                Mixed dice groups roll simultaneously in 3D mode.
              </p>
            ) : null}
            {cinematic3d ? (
              <p className="mt-1 text-xs text-slate-500">
                Cinematic physics enabled: slower throw with softer entry and longer settle time.
              </p>
            ) : null}
          </div>
        ) : null}

        {latestRollResult ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Result</p>
              <p className="mt-2 text-sm text-slate-300">
                {buildDiceNotation(latestRollResult.specs, latestRollResult.modifier)}
              </p>
              {latestRollDisplay && latestRollDisplay.primaryTotal !== null ? (
                <p className="mt-2 text-2xl font-semibold text-slate-100">
                  {latestRollDisplay.primaryTotal}
                  <span className="ml-2 text-sm font-medium text-slate-400">
                    ({latestRollDisplay.baseTotal}
                    {latestRollDisplay.modifier !== 0
                      ? ` ${formatModifierLabel(latestRollDisplay.modifier)}`
                      : ''}
                    )
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-300">
                  Per-type totals are shown below.
                  {latestRollResult.modifier !== 0
                    ? ` Global modifier ${formatModifierLabel(latestRollResult.modifier)} is not auto-applied.`
                    : ''}
                </p>
              )}

              {latestRollDisplay ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(latestRollDisplay?.perTypeTotals ?? []).map((entry) => (
                    <div
                      key={`total-${entry.sides}`}
                      className="rounded-lg border border-sky-700/50 bg-sky-950/30 px-3 py-1.5 text-xs text-sky-100"
                    >
                      d{entry.sides} sum: {entry.total} ({entry.count})
                    </div>
                  ))}
                  {(latestRollDisplay?.specialTotals ?? []).map((entry) => (
                    <div
                      key={`special-${entry.sides}`}
                      className="rounded-lg border border-amber-600/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100"
                    >
                      d{entry.sides} separate: {entry.total} ({entry.count})
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {groupedVisibleRolls.map((group) => (
                  <div
                    key={`group-${group.sides}`}
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200"
                  >
                    d{group.sides}: {group.values.join(', ')}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Actions</p>
              <button
                type="button"
                onClick={handleCopyRoll}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
              >
                Copy result
              </button>
              <p className="mt-2 text-xs text-slate-400">
                {rollCopyState === 'idle'
                  ? 'Copies compact notation.'
                  : rollCopyState === 'copied'
                    ? 'Copied.'
                    : 'Copy failed.'}
              </p>
            </div>
          </div>
        ) : null}

        {visibleRolls.length > 0 && !is3dMode ? (
          <div className="mt-4">
            <DiceTray rolls={visibleRolls} isAnimating={isAnimating} />
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">History</p>
            <p className="text-xs text-slate-500">Stored locally (max {MAX_HISTORY_ENTRIES})</p>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No rolls yet.</p>
          ) : (
            <ul className="grid gap-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/65 px-3 py-2"
                >
                  <p className="text-xs text-slate-400">{formatHistoryTimestamp(entry.ts)}</p>
                  <p className="mt-1 text-sm text-slate-100">
                    {entry.notation} = <span className="font-semibold">{entry.totalWithModifier}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {entry.groupedRolls
                      .map((group) => `d${group.sides}(${group.values.join(', ')})`)
                      .join(' ')}
                    {entry.hiddenRollCount > 0 ? ` +${entry.hiddenRollCount} more` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">Initiative Roller</h2>
        <p className="mt-1 text-sm text-slate-300">
          Roll d20 initiative for quick groups or NPCs from your local DM library.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setInitiativeMode('quick')}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              initiativeMode === 'quick'
                ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            Quick groups
          </button>
          <button
            type="button"
            onClick={() => setInitiativeMode('library')}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              initiativeMode === 'library'
                ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            From NPC Library
          </button>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 md:grid-cols-3">
          <label className="text-sm text-slate-300">
            Roll type
            <input
              type="text"
              value="d20"
              disabled
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300"
            />
          </label>
          <label className="text-sm text-slate-300">
            Global modifier
            <input
              type="number"
              value={globalInitiativeModifier}
              onChange={(event) =>
                setGlobalInitiativeModifier(normalizeModifier(parseIntegerInput(event.target.value)))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 md:mt-6">
            <input
              type="checkbox"
              checked={createIndividualEntries}
              onChange={(event) => setCreateIndividualEntries(event.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-sky-400"
            />
            Create individual entries
          </label>
        </div>

        {initiativeMode === 'quick' ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick groups</p>
              <button
                type="button"
                onClick={() => setQuickGroups((previous) => [...previous, createQuickGroup()])}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 transition hover:border-slate-500"
              >
                Add group
              </button>
            </div>

            <div className="grid gap-2">
              {quickGroups.map((group) => (
                <div
                  key={group.id}
                  className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/65 p-3 sm:grid-cols-[minmax(0,1fr)_90px_110px_auto]"
                >
                  <label className="text-xs text-slate-300">
                    Name
                    <input
                      type="text"
                      value={group.name}
                      onChange={(event) =>
                        handleQuickGroupFieldUpdate(group.id, 'name', event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Count
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={group.count}
                      onChange={(event) =>
                        handleQuickGroupFieldUpdate(group.id, 'count', event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Initiative mod
                    <input
                      type="number"
                      value={group.initiativeMod}
                      onChange={(event) =>
                        handleQuickGroupFieldUpdate(group.id, 'initiativeMod', event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickGroups((previous) => {
                        if (previous.length <= 1) {
                          return previous;
                        }
                        return previous.filter((row) => row.id !== group.id);
                      })
                    }
                    disabled={quickGroups.length <= 1}
                    className="self-end rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 transition hover:border-slate-500 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">NPC library</p>
              <label className="w-full max-w-sm text-xs text-slate-300">
                Search NPC
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
            </div>

            {libraryLoading ? (
              <p className="text-sm text-slate-300">Loading NPC library...</p>
            ) : libraryError ? (
              <p className="rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {libraryError}
              </p>
            ) : libraryNpcs.length === 0 ? (
              <p className="text-sm text-slate-300">No NPCs found in your library yet.</p>
            ) : (
              <div className="grid gap-2">
                {filteredNpcs.map((npc) => {
                  const selection = librarySelections[npc.id] ?? {
                    selected: false,
                    count: 1,
                    initiativeMod: npc.initiativeMod
                  };

                  return (
                    <div
                      key={npc.id}
                      className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/65 p-3 sm:grid-cols-[auto_minmax(0,1fr)_90px_110px]"
                    >
                      <label className="mt-5 inline-flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selection.selected}
                          onChange={(event) =>
                            handleLibrarySelectionChange(npc.id, {
                              selected: event.target.checked,
                              count: selection.count,
                              initiativeMod: selection.initiativeMod
                            })
                          }
                          className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-sky-400"
                        />
                      </label>
                      <div>
                        <p className="text-sm font-medium text-slate-100">{npc.name}</p>
                        <p className="text-xs text-slate-400">
                          Default initiative mod: {formatModifierLabel(npc.initiativeMod)}
                        </p>
                      </div>
                      <label className="text-xs text-slate-300">
                        Count
                        <input
                          type="number"
                          min={0}
                          max={99}
                          disabled={!selection.selected}
                          value={selection.count}
                          onChange={(event) =>
                            handleLibrarySelectionChange(npc.id, {
                              count: parseIntegerInput(event.target.value)
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-40"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        Initiative mod
                        <input
                          type="number"
                          disabled={!selection.selected}
                          value={selection.initiativeMod}
                          onChange={(event) =>
                            handleLibrarySelectionChange(npc.id, {
                              initiativeMod: parseIntegerInput(event.target.value)
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-40"
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRollInitiative}
            disabled={isRolling3d}
            className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            {isRolling3d ? 'Rolling Initiative...' : 'Roll Initiative'}
          </button>
          <button
            type="button"
            onClick={handleCopyInitiativeTable}
            disabled={initiativeResults.length === 0}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 transition hover:border-slate-500 disabled:opacity-40"
          >
            Copy as table
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-500"
          >
            Send to in-game (coming soon)
          </button>
          <span className="text-xs text-slate-400">
            {initiativeCopyState === 'idle'
              ? 'Copies TSV + Markdown.'
              : initiativeCopyState === 'copied'
                ? 'Copied.'
                : 'Copy failed.'}
          </span>
        </div>

        {initiativeError ? (
          <p className="mt-3 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {initiativeError}
          </p>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-xs uppercase tracking-[0.15em] text-slate-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">d20</th>
                <th className="px-3 py-2 text-right">Mod</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/45">
              {initiativeResults.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-400" colSpan={4}>
                    Roll initiative to see results.
                  </td>
                </tr>
              ) : (
                initiativeResults.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800 text-slate-100">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 text-right">{row.d20}</td>
                    <td className="px-3 py-2 text-right">{formatModifierLabel(row.modifier)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{row.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};
