import { Container, Graphics } from 'pixi.js';

import type { MiniSceneController, MiniSceneFactoryArgs } from './types';

export const createDmScene = (args: MiniSceneFactoryArgs): MiniSceneController => {
  const root = new Container();
  const backdrop = new Graphics();
  const glow = new Graphics();
  const book = new Graphics();
  const map = new Graphics();
  const quill = new Graphics();

  root.addChild(backdrop, glow, map, book, quill);

  let width = Math.max(140, args.width);
  let height = Math.max(90, args.height);
  let elapsed = 0;
  let active = false;
  let activeStrength = 0;
  let burstStrength = 0;

  const draw = (): void => {
    const target = active && !args.reducedMotion ? 1 : 0;
    activeStrength += (target - activeStrength) * 0.16;
    burstStrength = Math.max(0, burstStrength - 0.024);
    const effect = Math.max(activeStrength, burstStrength * 0.9);
    const pulse = args.reducedMotion ? 0 : (Math.sin(elapsed * 0.0026) + 1) * 0.5;

    backdrop.clear();
    backdrop.roundRect(0, 0, width, height, 18).fill({
      color: 0x120b24,
      alpha: 0.98
    });
    backdrop.roundRect(8, 8, width - 16, height - 16, 14).fill({
      color: 0x4c1d95,
      alpha: 0.14 + effect * 0.2
    });

    const glowRadiusX = Math.max(40, width * 0.25 + effect * 12);
    const glowRadiusY = Math.max(24, height * 0.18 + effect * 8);
    glow.clear();
    glow.ellipse(width * 0.28, height * 0.42, glowRadiusX, glowRadiusY).fill({
      color: 0x8b5cf6,
      alpha: 0.08 + effect * 0.18 + pulse * 0.05
    });

    const mapX = width * 0.24;
    const mapY = height * 0.26 + (args.reducedMotion ? 0 : Math.sin(elapsed * 0.0018) * 1.2);
    const pageFlip = effect * 6;
    map.clear();
    map.roundRect(mapX - 34, mapY - 12, 68, 42, 7).fill({
      color: 0x1e293b,
      alpha: 0.85
    });
    map.moveTo(mapX - 20, mapY + 3).lineTo(mapX - 6 + pageFlip * 0.2, mapY - 5).lineTo(mapX + 10, mapY + 8).stroke({
      color: 0x7dd3fc,
      width: 2,
      alpha: 0.75
    });
    map.circle(mapX + 14, mapY + 1, 4.2).fill({
      color: 0xfacc15,
      alpha: 0.8
    });

    const bookCenterX = width * 0.62 + effect * 3;
    const bookCenterY = height * 0.56 - effect * 2;
    book.clear();
    book.roundRect(bookCenterX - 36, bookCenterY - 22, 72, 44, 8).fill({
      color: 0x0f172a,
      alpha: 0.98
    });
    book.roundRect(bookCenterX - 2, bookCenterY - 22, 4, 44, 2).fill({
      color: 0x7c3aed,
      alpha: 0.95
    });
    book.roundRect(bookCenterX - 30, bookCenterY - 14, 24 + pageFlip, 3, 1.5).fill({
      color: 0xa78bfa,
      alpha: 0.85
    });
    book.roundRect(bookCenterX + 8, bookCenterY - 6, 20 - pageFlip * 0.7, 3, 1.5).fill({
      color: 0xa78bfa,
      alpha: 0.74
    });

    const quillTilt = args.reducedMotion ? 0 : Math.sin(elapsed * 0.003) * 0.2 + effect * 0.08;
    quill.clear();
    quill.moveTo(bookCenterX + 26, bookCenterY - 28).lineTo(bookCenterX + 46, bookCenterY - 4).stroke({
      color: 0xfde68a,
      width: 3,
      alpha: 0.9
    });
    quill.circle(bookCenterX + 47, bookCenterY - 2, 2.5).fill({
      color: 0xf59e0b,
      alpha: 0.95
    });
    quill.pivot.set(bookCenterX + 36, bookCenterY - 16);
    quill.position.set(bookCenterX + 36, bookCenterY - 16);
    quill.rotation = quillTilt;
  };

  const resize = (nextWidth: number, nextHeight: number): void => {
    width = Math.max(140, nextWidth);
    height = Math.max(90, nextHeight);
    draw();
  };

  const tick = (deltaMs: number): void => {
    if (!args.reducedMotion) {
      elapsed += deltaMs;
    }
    draw();
  };

  const renderStatic = (): void => {
    activeStrength = 0;
    burstStrength = 0;
    elapsed = 0;
    draw();
  };

  resize(width, height);

  return {
    root,
    resize,
    setActive: (nextActive: boolean) => {
      active = nextActive;
      draw();
    },
    playBurst: () => {
      if (args.reducedMotion) {
        return;
      }
      burstStrength = 1;
      draw();
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
