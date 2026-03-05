import { Container, Graphics } from 'pixi.js';

import type { MiniSceneController, MiniSceneFactoryArgs } from './types';

type HeroNode = {
  node: Container;
  baseX: number;
  head: Graphics;
  body: Graphics;
  shadow: Graphics;
};

const createHero = (args: { bodyColor: number; headColor: number; accentColor: number }): HeroNode => {
  const node = new Container();
  const shadow = new Graphics();
  shadow.ellipse(0, 0, 16, 5).fill({
    color: 0x020617,
    alpha: 0.24
  });
  shadow.y = 36;
  node.addChild(shadow);

  const body = new Graphics();
  body.roundRect(-12, 0, 24, 28, 9).fill({
    color: args.bodyColor,
    alpha: 0.95
  });
  body.roundRect(-10, 10, 20, 3, 2).fill({
    color: args.accentColor,
    alpha: 0.65
  });
  node.addChild(body);

  const head = new Graphics();
  head.circle(0, -10, 9).fill({
    color: args.headColor,
    alpha: 1
  });
  node.addChild(head);

  return {
    node,
    baseX: 0,
    head,
    body,
    shadow
  };
};

export const createPlayerScene = (args: MiniSceneFactoryArgs): MiniSceneController => {
  const root = new Container();
  const backdrop = new Graphics();
  root.addChild(backdrop);

  const heroes: HeroNode[] = [
    createHero({
      bodyColor: 0x1d4ed8,
      headColor: 0x93c5fd,
      accentColor: 0x7dd3fc
    }),
    createHero({
      bodyColor: 0x0f766e,
      headColor: 0xa7f3d0,
      accentColor: 0x34d399
    }),
    createHero({
      bodyColor: 0x7e22ce,
      headColor: 0xe9d5ff,
      accentColor: 0xc4b5fd
    })
  ];

  for (const hero of heroes) {
    root.addChild(hero.node);
  }

  let width = Math.max(140, args.width);
  let height = Math.max(90, args.height);
  let elapsed = 0;
  let active = false;
  let activeStrength = 0;
  let burstStrength = 0;

  const applyBackdrop = (effect: number): void => {
    backdrop.clear();
    backdrop.roundRect(0, 0, width, height, 18).fill({
      color: 0x0b1324,
      alpha: 0.98
    });

    backdrop.roundRect(8, 8, width - 16, height - 16, 14).fill({
      color: 0x172554,
      alpha: 0.2 + effect * 0.16
    });
  };

  const layoutHeroes = (): void => {
    const baselineY = height * 0.48;
    const laneSpacing = width / 4;

    const [left, center, right] = heroes;
    if (left && center && right) {
      left.baseX = laneSpacing * 1.15;
      center.baseX = laneSpacing * 2;
      right.baseX = laneSpacing * 2.85;
    }

    for (const hero of heroes) {
      hero.node.x = hero.baseX;
      hero.node.y = baselineY;
    }
  };

  const applyFrame = (): void => {
    const target = active && !args.reducedMotion ? 1 : 0;
    activeStrength += (target - activeStrength) * 0.16;
    burstStrength = Math.max(0, burstStrength - 0.025);
    const effect = Math.max(activeStrength, burstStrength * 0.85);

    applyBackdrop(effect);

    const amplitude = args.reducedMotion ? 0 : 1.4 + effect * 2.2;
    for (const [index, hero] of heroes.entries()) {
      const phase = elapsed * 0.0022 + index * 0.9;
      const bob = Math.sin(phase) * amplitude;
      const stepForward = (index === 1 ? 7 : 4) * effect;
      const tilt = (index === 1 ? 0.05 : 0.02) * Math.sin(phase * 0.8) * (activeStrength + 0.2);

      hero.node.x = hero.baseX + stepForward;
      hero.node.y = height * 0.48 + bob - effect * 3.2;
      hero.node.scale.set(0.96 + (index === 1 ? 0.18 : 0.08) * effect);
      hero.node.rotation = args.reducedMotion ? 0 : tilt;
      hero.shadow.scale.set(1 + effect * 0.24, 1 - effect * 0.08);
      hero.shadow.alpha = 0.24 + effect * 0.08;
    }
  };

  const resize = (nextWidth: number, nextHeight: number): void => {
    width = Math.max(140, nextWidth);
    height = Math.max(90, nextHeight);
    layoutHeroes();
    applyFrame();
  };

  const tick = (deltaMs: number): void => {
    if (!args.reducedMotion) {
      elapsed += deltaMs;
    }
    applyFrame();
  };

  const renderStatic = (): void => {
    activeStrength = 0;
    burstStrength = 0;
    elapsed = 0;
    applyFrame();
  };

  resize(width, height);

  return {
    root,
    resize,
    setActive: (nextActive: boolean) => {
      active = nextActive;
      applyFrame();
    },
    playBurst: () => {
      if (args.reducedMotion) {
        return;
      }
      burstStrength = 1;
      applyFrame();
    },
    tick,
    renderStatic,
    destroy: () => {
      root.destroy({
        children: true
      });
    }
  };
};
