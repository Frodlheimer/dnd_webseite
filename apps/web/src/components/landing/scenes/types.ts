import type { Container } from 'pixi.js';

export type MiniSceneController = {
  root: Container;
  resize: (width: number, height: number) => void;
  setActive: (active: boolean) => void;
  playBurst: () => void;
  tick: (deltaMs: number) => void;
  renderStatic: () => void;
  destroy: () => void;
};

export type MiniSceneFactoryArgs = {
  width: number;
  height: number;
  reducedMotion: boolean;
};
