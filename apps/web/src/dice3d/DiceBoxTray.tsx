import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';

type DiceBoxRollDie = {
  sides: number;
  value: number;
  modifier: number;
};

export type DiceBoxTrayRef = {
  isReady: () => boolean;
  roll: (notation: string) => Promise<DiceBoxRollDie[]>;
  rollMany: (notations: string[]) => Promise<DiceBoxRollDie[][]>;
  clear: () => void;
};

export type DiceBoxPhysicsConfig = {
  size: number;
  startingHeight: number;
  throwForce: number;
  spinForce: number;
  delay: number;
  gravity: number;
  mass: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  settleTimeout: number;
};

export type DiceBoxRenderConfig = {
  lightIntensity: number;
  shadowTransparency: number;
  enableShadows: boolean;
  themeColor?: string;
};

type DiceBoxTrayProps = {
  enabled: boolean;
  diceScale?: number;
  physicsConfig?: Partial<DiceBoxPhysicsConfig>;
  renderConfig?: Partial<DiceBoxRenderConfig>;
  className?: string;
  style?: CSSProperties;
  onReadyChange?: (ready: boolean) => void;
  onError?: (error: Error) => void;
  onRollingChange?: (rolling: boolean) => void;
};

type DiceBoxInstance = {
  init: () => Promise<unknown>;
  roll: (notation: string) => Promise<unknown>;
  add?: (notation: string, options?: Record<string, unknown>) => Promise<unknown>;
  clear: () => unknown;
  updateConfig?: (config: Record<string, unknown>) => Promise<unknown> | unknown;
};

const createTrayDomId = (): string => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `dicebox-tray-${globalThis.crypto.randomUUID()}`;
  }

  return `dicebox-tray-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const parseSides = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'd100' || normalized === '100') {
    return 100;
  }

  const stripped = normalized.replace(/^d/i, '');
  const parsed = Number.parseInt(stripped, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseModifier = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const collectDice = (value: unknown, output: DiceBoxRollDie[]): void => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectDice(entry, output);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  const nestedRolls = record.rolls;
  if (Array.isArray(nestedRolls)) {
    collectDice(nestedRolls, output);
  }

  const sides = parseSides(record.sides ?? record.dieType);
  const rawValue = record.value;
  if (sides === null || typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return;
  }

  output.push({
    sides,
    value: Math.max(1, Math.trunc(rawValue)),
    modifier: parseModifier(record.modifier)
  });
};

const normalizeDiceResult = (result: unknown): DiceBoxRollDie[] => {
  const output: DiceBoxRollDie[] = [];
  collectDice(result, output);
  return output;
};

const clampConfigValue = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(min, Math.min(max, value));
};

const normalizePhysicsConfig = (
  config: Partial<DiceBoxPhysicsConfig> | undefined
): Record<string, number> => {
  if (!config) {
    return {};
  }

  const normalized: Record<string, number> = {};
  const size = clampConfigValue(config.size, 4, 40);
  const startingHeight = clampConfigValue(config.startingHeight, 1, 30);
  const throwForce = clampConfigValue(config.throwForce, 0.1, 20);
  const spinForce = clampConfigValue(config.spinForce, 0.1, 20);
  const delay = clampConfigValue(config.delay, 0, 600);
  const gravity = clampConfigValue(config.gravity, 0.05, 3);
  const mass = clampConfigValue(config.mass, 0.1, 5);
  const friction = clampConfigValue(config.friction, 0.01, 2);
  const restitution = clampConfigValue(config.restitution, 0, 1);
  const linearDamping = clampConfigValue(config.linearDamping, 0, 2);
  const angularDamping = clampConfigValue(config.angularDamping, 0, 2);
  const settleTimeout = clampConfigValue(config.settleTimeout, 500, 15000);

  if (size !== null) {
    normalized.size = size;
  }
  if (startingHeight !== null) {
    normalized.startingHeight = startingHeight;
  }
  if (throwForce !== null) {
    normalized.throwForce = throwForce;
  }
  if (spinForce !== null) {
    normalized.spinForce = spinForce;
  }
  if (delay !== null) {
    normalized.delay = delay;
  }
  if (gravity !== null) {
    normalized.gravity = gravity;
  }
  if (mass !== null) {
    normalized.mass = mass;
  }
  if (friction !== null) {
    normalized.friction = friction;
  }
  if (restitution !== null) {
    normalized.restitution = restitution;
  }
  if (linearDamping !== null) {
    normalized.linearDamping = linearDamping;
  }
  if (angularDamping !== null) {
    normalized.angularDamping = angularDamping;
  }
  if (settleTimeout !== null) {
    normalized.settleTimeout = settleTimeout;
  }

  return normalized;
};

const normalizeRenderConfig = (
  config: Partial<DiceBoxRenderConfig> | undefined
): Record<string, string | number | boolean> => {
  if (!config) {
    return {};
  }

  const normalized: Record<string, string | number | boolean> = {};
  const lightIntensity = clampConfigValue(config.lightIntensity, 0.2, 3);
  const shadowTransparency = clampConfigValue(config.shadowTransparency, 0, 1);
  const hasEnableShadows = typeof config.enableShadows === 'boolean';

  if (lightIntensity !== null) {
    normalized.lightIntensity = lightIntensity;
  }
  if (shadowTransparency !== null) {
    normalized.shadowTransparency = shadowTransparency;
  }
  if (hasEnableShadows) {
    normalized.enableShadows = config.enableShadows as boolean;
  }
  if (typeof config.themeColor === 'string' && config.themeColor.trim().length > 0) {
    normalized.themeColor = config.themeColor.trim();
  }

  return normalized;
};

export const DiceBoxTray = forwardRef<DiceBoxTrayRef, DiceBoxTrayProps>(
  (
    {
      enabled,
      diceScale = 8,
      physicsConfig,
      renderConfig,
      className,
      style,
      onReadyChange,
      onError,
      onRollingChange
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const containerIdRef = useRef<string>(createTrayDomId());
    const boxRef = useRef<DiceBoxInstance | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const normalizedPhysicsConfig = useMemo(
      () => normalizePhysicsConfig(physicsConfig),
      [physicsConfig]
    );
    const normalizedRenderConfig = useMemo(
      () => normalizeRenderConfig(renderConfig),
      [renderConfig]
    );

    useImperativeHandle(
      ref,
      () => ({
        isReady: () => status === 'ready' && boxRef.current !== null,
        async roll(notation: string): Promise<DiceBoxRollDie[]> {
          if (!boxRef.current) {
            throw new Error('3D dice tray is not ready.');
          }

          onRollingChange?.(true);
          try {
            const raw = await boxRef.current.roll(notation);
            const normalized = normalizeDiceResult(raw);
            if (normalized.length === 0) {
              throw new Error('3D dice returned no roll values.');
            }
            return normalized;
          } finally {
            onRollingChange?.(false);
          }
        },
        async rollMany(notations: string[]): Promise<DiceBoxRollDie[][]> {
          if (!boxRef.current) {
            throw new Error('3D dice tray is not ready.');
          }

          const cleanedNotations = notations.map((notation) => notation.trim()).filter(Boolean);
          if (cleanedNotations.length === 0) {
            return [];
          }

          onRollingChange?.(true);
          try {
            if (boxRef.current.add) {
              boxRef.current.clear();
              const rawGroups = await Promise.all(
                cleanedNotations.map((notation, index) =>
                  boxRef.current?.add?.(notation, {
                    newStartPoint: index === 0
                  }) ?? Promise.resolve([])
                )
              );

              return rawGroups.map((rawGroup) => {
                const normalized = normalizeDiceResult(rawGroup);
                if (normalized.length === 0) {
                  throw new Error('3D dice returned no roll values for at least one die group.');
                }
                return normalized;
              });
            }

            const sequentialGroups: DiceBoxRollDie[][] = [];
            for (const notation of cleanedNotations) {
              const raw = await boxRef.current.roll(notation);
              const normalized = normalizeDiceResult(raw);
              if (normalized.length === 0) {
                throw new Error('3D dice returned no roll values for at least one die group.');
              }
              sequentialGroups.push(normalized);
            }
            return sequentialGroups;
          } finally {
            onRollingChange?.(false);
          }
        },
        clear: () => {
          boxRef.current?.clear();
        }
      }),
      [onRollingChange, status]
    );

    useEffect(() => {
      if (!enabled) {
        setStatus('idle');
        onReadyChange?.(false);
        if (boxRef.current) {
          boxRef.current.clear();
        }
        return;
      }

      let cancelled = false;
      let activeBox: DiceBoxInstance | null = null;

      const init = async () => {
        if (!containerRef.current) {
          return;
        }

        setStatus('loading');

        try {
          await import('@3d-dice/dice-box/dist/style.css');
          const module = await import('@3d-dice/dice-box');
          if (cancelled || !containerRef.current) {
            return;
          }

          const DiceBoxCtor = module.default as unknown as new (
            selector: string,
            config: Record<string, unknown>
          ) => DiceBoxInstance;
          const instance = new DiceBoxCtor(`#${containerIdRef.current}`, {
            assetPath: '/assets/dice-box/',
            offscreen: true,
            theme: 'default',
            scale: Math.max(4, Math.trunc(diceScale)),
            ...normalizedPhysicsConfig,
            ...normalizedRenderConfig
          });
          activeBox = instance;
          await instance.init();
          if (cancelled) {
            instance.clear();
            return;
          }

          boxRef.current = instance;
          setStatus('ready');
          onReadyChange?.(true);
        } catch (error) {
          if (cancelled) {
            return;
          }
          boxRef.current = null;
          setStatus('error');
          onReadyChange?.(false);
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      };

      void init();

      return () => {
        cancelled = true;
        onReadyChange?.(false);
        if (activeBox) {
          activeBox.clear();
        }
        boxRef.current = null;
      };
    }, [enabled, onError, onReadyChange]);

    useEffect(() => {
      if (!enabled || status !== 'ready' || !boxRef.current?.updateConfig) {
        return;
      }

      const nextScale = Math.max(4, Math.trunc(diceScale));
      void boxRef.current.updateConfig({
        scale: nextScale,
        ...normalizedPhysicsConfig,
        ...normalizedRenderConfig
      });
    }, [diceScale, enabled, normalizedPhysicsConfig, normalizedRenderConfig, status]);

    return (
      <div className={`relative ${className ?? ''}`} style={style}>
        <div
          ref={containerRef}
          id={containerIdRef.current}
          className="dicebox-host relative mx-auto h-full w-full rounded-[0.95rem] bg-[linear-gradient(120deg,_#16254c_0%,_#213665_52%,_#15274f_100%)]"
        />
        {status === 'loading' ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.18em] text-slate-300">
            Loading 3D dice...
          </div>
        ) : null}
      </div>
    );
  }
);

DiceBoxTray.displayName = 'DiceBoxTray';
