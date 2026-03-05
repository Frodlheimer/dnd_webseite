import { useEffect, useMemo, useRef, useState } from 'react';

import type { Application } from 'pixi.js';

import { useIntersectionVisible } from './useIntersectionVisible';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import type { MiniSceneController } from './scenes/types';

type MiniPixiStageProps = {
  scene: 'player' | 'dm';
  isActive: boolean;
  burstKey: number;
  className?: string;
};

const BURST_DURATION_MS = 900;

const resolveStageSize = (element: HTMLElement): { width: number; height: number } => {
  const rect = element.getBoundingClientRect();
  const width = Math.max(140, Math.floor(rect.width));
  const height = Math.max(90, Math.floor(rect.height));
  return {
    width,
    height
  };
};

export const MiniPixiStage = ({ scene, isActive, burstKey, className }: MiniPixiStageProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<MiniSceneController | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const tickerRunningRef = useRef(false);
  const activeRef = useRef(false);
  const burstUntilRef = useRef(0);
  const pendingBurstRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const prefersReducedMotion = usePrefersReducedMotion();
  const isVisible = useIntersectionVisible(mountRef, {
    rootMargin: '180px',
    threshold: 0.25,
    once: true
  });
  const shouldInitialize = isVisible || isActive || burstKey > 0;

  const classes = useMemo(() => {
    return [
      'h-40 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950/80',
      className ?? ''
    ]
      .filter(Boolean)
      .join(' ');
  }, [className]);

  useEffect(() => {
    if (!shouldInitialize) {
      return;
    }

    if (appRef.current || !mountRef.current) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      const mountNode = mountRef.current;
      if (!mountNode) {
        return;
      }

      const [{ Application }, factory] = await Promise.all([
        import('pixi.js'),
        scene === 'player'
          ? import('./scenes/playerScene').then((module) => module.createPlayerScene)
          : import('./scenes/dmScene').then((module) => module.createDmScene)
      ]);

      if (cancelled || !mountRef.current) {
        return;
      }

      const pixiApp = new Application();
      await pixiApp.init({
        resizeTo: mountNode,
        antialias: true,
        backgroundAlpha: 0
      });

      if (cancelled || !mountRef.current) {
        pixiApp.destroy();
        return;
      }

      pixiApp.canvas.style.width = '100%';
      pixiApp.canvas.style.height = '100%';
      pixiApp.canvas.style.display = 'block';
      mountNode.appendChild(pixiApp.canvas);

      const size = resolveStageSize(mountNode);
      const controller = factory({
        width: size.width,
        height: size.height,
        reducedMotion: prefersReducedMotion
      });

      pixiApp.stage.addChild(controller.root);
      pixiApp.ticker.add((ticker) => {
        controller.tick(ticker.deltaMS);

        if (!activeRef.current && Date.now() >= burstUntilRef.current) {
          controller.setActive(false);
          if (tickerRunningRef.current) {
            pixiApp.ticker.stop();
            tickerRunningRef.current = false;
            controller.renderStatic();
            pixiApp.render();
          }
        }
      });
      pixiApp.ticker.stop();

      const resizeObserver = new ResizeObserver(() => {
        if (!mountRef.current || !sceneRef.current || !appRef.current) {
          return;
        }

        const nextSize = resolveStageSize(mountRef.current);
        sceneRef.current.resize(nextSize.width, nextSize.height);
        appRef.current.render();
      });
      resizeObserver.observe(mountNode);

      appRef.current = pixiApp;
      sceneRef.current = controller;
      resizeObserverRef.current = resizeObserver;

      controller.setActive(activeRef.current && !prefersReducedMotion);
      if (prefersReducedMotion) {
        controller.renderStatic();
        pixiApp.render();
      } else if (activeRef.current || Date.now() < burstUntilRef.current) {
        if (pendingBurstRef.current || Date.now() < burstUntilRef.current) {
          controller.playBurst();
          pendingBurstRef.current = false;
        }
        pixiApp.ticker.start();
        tickerRunningRef.current = true;
      } else {
        controller.renderStatic();
        pixiApp.render();
      }

      setIsInitialized(true);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion, scene, shouldInitialize]);

  useEffect(() => {
    activeRef.current = isActive;
    const app = appRef.current;
    const controller = sceneRef.current;
    if (!app || !controller) {
      return;
    }

    controller.setActive(isActive && !prefersReducedMotion);

    if (prefersReducedMotion) {
      controller.renderStatic();
      app.render();
      if (tickerRunningRef.current) {
        app.ticker.stop();
        tickerRunningRef.current = false;
      }
      return;
    }

    if (isActive) {
      if (!tickerRunningRef.current) {
        app.ticker.start();
        tickerRunningRef.current = true;
      }
      return;
    }

    if (Date.now() < burstUntilRef.current) {
      if (!tickerRunningRef.current) {
        app.ticker.start();
        tickerRunningRef.current = true;
      }
      return;
    }

    if (tickerRunningRef.current) {
      app.ticker.stop();
      tickerRunningRef.current = false;
    }
    controller.renderStatic();
    app.render();
  }, [isActive, prefersReducedMotion]);

  useEffect(() => {
    if (burstKey === 0 || prefersReducedMotion) {
      return;
    }

    burstUntilRef.current = Date.now() + BURST_DURATION_MS;
    pendingBurstRef.current = true;
    const app = appRef.current;
    const controller = sceneRef.current;
    if (!app || !controller) {
      return;
    }

    controller.playBurst();
    pendingBurstRef.current = false;
    if (!tickerRunningRef.current) {
      app.ticker.start();
      tickerRunningRef.current = true;
    }
  }, [burstKey, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      sceneRef.current?.destroy();
      sceneRef.current = null;

      if (appRef.current) {
        appRef.current.destroy(true, {
          children: true
        });
        appRef.current = null;
      }
    };
  }, []);

  return (
    <div className={classes} ref={mountRef} aria-hidden="true">
      {!isInitialized ? (
        <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.25em] text-slate-500">
          scene
        </div>
      ) : null}
    </div>
  );
};
