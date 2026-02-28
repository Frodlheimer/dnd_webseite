import { useEffect, useRef } from 'react';
import { Application, Graphics, Text } from 'pixi.js';

const GRID_SIZE = 48;

const drawGrid = (app: Application, graphics: Graphics) => {
  const width = app.screen.width;
  const height = app.screen.height;

  graphics.clear();

  for (let x = 0; x <= width; x += GRID_SIZE) {
    graphics.moveTo(x, 0);
    graphics.lineTo(x, height);
  }

  for (let y = 0; y <= height; y += GRID_SIZE) {
    graphics.moveTo(0, y);
    graphics.lineTo(width, y);
  }

  graphics.stroke({
    color: 0x334155,
    width: 1,
    alpha: 0.9
  });
};

export const BoardCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mountNode = mountRef.current;

    if (!mountNode) {
      return;
    }

    const app = new Application();
    const graphics = new Graphics();

    const init = async () => {
      await app.init({
        resizeTo: mountNode,
        background: '#0b1220',
        antialias: true
      });

      mountNode.appendChild(app.canvas);
      app.stage.addChild(graphics);
      drawGrid(app, graphics);

      const label = new Text({
        text: 'Board ready',
        style: {
          fill: '#cbd5e1',
          fontSize: 20,
          fontFamily: 'monospace'
        }
      });

      label.x = 16;
      label.y = 16;

      app.stage.addChild(label);

      app.renderer.on('resize', () => {
        drawGrid(app, graphics);
      });
    };

    void init();

    return () => {
      app.destroy(true, {
        children: true,
        texture: true
      });
    };
  }, []);

  return <div ref={mountRef} className="h-full min-h-[480px] overflow-hidden rounded border border-slate-700" />;
};
