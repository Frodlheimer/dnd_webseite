import { useCallback, useEffect, useRef, useState } from 'react';

import { randomIntInclusive } from '../rng';

export type DiceFace = {
  sides: number;
  value: number;
};

const FRAME_STEP_MS = 60;
const DEFAULT_DURATION_MS = 760;

const buildRandomFrame = (rolls: DiceFace[]): DiceFace[] => {
  return rolls.map((roll) => ({
    sides: roll.sides,
    value: randomIntInclusive(1, roll.sides)
  }));
};

export const useDiceAnimation = (enabled: boolean) => {
  const [animatedRolls, setAnimatedRolls] = useState<DiceFace[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const frameRef = useRef<number | null>(null);

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const startAnimation = useCallback(
    (finalRolls: DiceFace[], durationMs = DEFAULT_DURATION_MS): void => {
      stopAnimation();
      if (!enabled || finalRolls.length === 0) {
        setAnimatedRolls(finalRolls);
        return;
      }

      setIsAnimating(true);
      setAnimatedRolls(buildRandomFrame(finalRolls));

      const startedAt = performance.now();
      let lastFrameAt = startedAt;

      const animate = (now: number) => {
        const elapsed = now - startedAt;
        if (elapsed >= durationMs) {
          setAnimatedRolls(finalRolls);
          stopAnimation();
          return;
        }

        if (now - lastFrameAt >= FRAME_STEP_MS) {
          lastFrameAt = now;
          setAnimatedRolls(buildRandomFrame(finalRolls));
        }

        frameRef.current = window.requestAnimationFrame(animate);
      };

      frameRef.current = window.requestAnimationFrame(animate);
    },
    [enabled, stopAnimation]
  );

  return {
    animatedRolls,
    isAnimating,
    startAnimation,
    setAnimatedRolls,
    stopAnimation
  };
};
