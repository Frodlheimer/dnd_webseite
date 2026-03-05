import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';

import type {
  ImageRef,
  MapEditBrush,
  MapEditElement,
  MapEditEraseStroke,
  MapEditOperation,
  MapEditOpsAppliedMessage,
  MapEditSnapshot,
  MapTextAlign,
  VttToken
} from '@dnd-vtt/shared';

import type { BoardSettings, StackDisplayMode, TokenDraft } from './boardTypes';

const TOKEN_PIXEL_SCALE = 42;
const TOKEN_PREVIEW_DIAMETER = 80;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const DEFAULT_BOARD_SIZE = 2800;
const MAP_EDIT_HISTORY_LIMIT = 80;
const DEFAULT_TEXT_FONT = 'Cinzel, serif';
const DEFAULT_BRUSH_PRESET: MapEditBrush = 'PEN';
const MAX_POINTS_PER_ERASE_STROKE = 1_200;
const MAX_ERASE_STROKES_PER_ELEMENT = 160;
const MAX_CUSTOM_MAP_OBJECTS = 80;
const MAP_OBJECT_LIBRARY_STORAGE_KEY = 'dnd-vtt-map-object-library-v1';
const TEXT_FONT_FAMILIES = [
  'Cinzel, serif',
  'Arial, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Courier New, monospace',
  'Trebuchet MS, sans-serif',
  'Verdana, sans-serif'
];

const createObjectPlaceholderDataUrl = (args: { icon: string; bg: string; fg: string }) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="3" y="3" width="122" height="122" rx="16" fill="${args.bg}" stroke="#0f172a" stroke-width="6"/><text x="64" y="75" text-anchor="middle" font-size="50" font-family="Arial, sans-serif" fill="${args.fg}">${args.icon}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

type MapObjectLibraryItem = {
  id: string;
  label: string;
  sourceUrl: string;
  imageRef: ImageRef;
  width: number;
  height: number;
  builtin: boolean;
};

const DEFAULT_MAP_OBJECT_LIBRARY: MapObjectLibraryItem[] = [
  {
    id: 'obj-placeholder-a',
    label: 'Objekt A',
    sourceUrl: createObjectPlaceholderDataUrl({
      icon: 'A',
      bg: '#334155',
      fg: '#38bdf8'
    }),
    imageRef: {
      kind: 'CLOUD_ASSET',
      assetId: 'builtin:obj-placeholder-a'
    },
    width: 72,
    height: 72,
    builtin: true
  },
  {
    id: 'obj-placeholder-b',
    label: 'Objekt B',
    sourceUrl: createObjectPlaceholderDataUrl({
      icon: 'B',
      bg: '#1e293b',
      fg: '#a78bfa'
    }),
    imageRef: {
      kind: 'CLOUD_ASSET',
      assetId: 'builtin:obj-placeholder-b'
    },
    width: 72,
    height: 72,
    builtin: true
  },
  {
    id: 'obj-placeholder-c',
    label: 'Objekt C',
    sourceUrl: createObjectPlaceholderDataUrl({
      icon: 'C',
      bg: '#3f3f46',
      fg: '#f59e0b'
    }),
    imageRef: {
      kind: 'CLOUD_ASSET',
      assetId: 'builtin:obj-placeholder-c'
    },
    width: 72,
    height: 72,
    builtin: true
  },
  {
    id: 'obj-placeholder-d',
    label: 'Objekt D',
    sourceUrl: createObjectPlaceholderDataUrl({
      icon: 'D',
      bg: '#374151',
      fg: '#34d399'
    }),
    imageRef: {
      kind: 'CLOUD_ASSET',
      assetId: 'builtin:obj-placeholder-d'
    },
    width: 72,
    height: 72,
    builtin: true
  }
];

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const degToRad = (deg: number): number => {
  return (deg * Math.PI) / 180;
};

const defaultTokenColor = (kind: TokenDraft['kind']): string => {
  if (kind === 'ALLY') {
    return '#22c55e';
  }

  if (kind === 'ENEMY') {
    return '#ef4444';
  }

  return '#7dd3fc';
};

const parseTokenColor = (color: string | null | undefined, kind: TokenDraft['kind']): number => {
  const fallback = defaultTokenColor(kind);
  const normalized = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
  return Number.parseInt(normalized.replace('#', ''), 16);
};

const parseHexColor = (color: string | null | undefined, fallback: number): number => {
  if (!color) {
    return fallback;
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return fallback;
  }

  return Number.parseInt(color.replace('#', ''), 16);
};

const sanitizeFontFamily = (fontFamily: string | null | undefined): string => {
  const normalized = (fontFamily ?? '').trim();
  if (!normalized) {
    return DEFAULT_TEXT_FONT;
  }

  const normalizedLower = normalized.toLowerCase();
  const matched = TEXT_FONT_FAMILIES.find((font) => {
    const fontLower = font.toLowerCase();
    const primary = font.split(',')[0]?.trim().toLowerCase() ?? '';
    return fontLower === normalizedLower || primary === normalizedLower;
  });

  return matched ?? DEFAULT_TEXT_FONT;
};

const sanitizeMapObjectLibraryItem = (candidate: unknown): MapObjectLibraryItem | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  const sourceUrl = typeof value.sourceUrl === 'string' ? value.sourceUrl.trim() : '';
  if (!sourceUrl.startsWith('data:image/')) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : 'Object';
  const width = Number.isFinite(value.width) ? Number(value.width) : 72;
  const height = Number.isFinite(value.height) ? Number(value.height) : 72;

  if (!id) {
    return null;
  }

  let imageRef: ImageRef = {
    kind: 'CLOUD_ASSET',
    assetId: `inline:${id}`
  };
  if (value.imageRef && typeof value.imageRef === 'object') {
    const candidate = value.imageRef as Record<string, unknown>;
    if (
      candidate.kind === 'LOCAL_ASSET' &&
      typeof candidate.hash === 'string' &&
      candidate.hash.trim().length > 0
    ) {
      imageRef = {
        kind: 'LOCAL_ASSET',
        hash: candidate.hash.trim()
      };
    } else if (
      candidate.kind === 'CLOUD_ASSET' &&
      typeof candidate.assetId === 'string' &&
      candidate.assetId.trim().length > 0
    ) {
      imageRef = {
        kind: 'CLOUD_ASSET',
        assetId: candidate.assetId.trim()
      };
    }
  }

  return {
    id,
    label: label.slice(0, 80) || 'Object',
    sourceUrl,
    imageRef,
    width: clamp(Math.round(width), 24, 400),
    height: clamp(Math.round(height), 24, 400),
    builtin: false
  };
};

const loadStoredMapObjectLibrary = (): MapObjectLibraryItem[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_MAP_OBJECT_LIBRARY;
  }

  try {
    const raw = window.localStorage.getItem(MAP_OBJECT_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_MAP_OBJECT_LIBRARY;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_MAP_OBJECT_LIBRARY;
    }

    const customItems = parsed
      .map((entry) => sanitizeMapObjectLibraryItem(entry))
      .filter((entry): entry is MapObjectLibraryItem => entry !== null)
      .slice(0, MAX_CUSTOM_MAP_OBJECTS);

    return [...DEFAULT_MAP_OBJECT_LIBRARY, ...customItems];
  } catch {
    return DEFAULT_MAP_OBJECT_LIBRARY;
  }
};

const createMapEditId = (): string => {
  return `map-edit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

const getSquareCell = (
  x: number,
  y: number,
  cellSize: number,
  originX: number,
  originY: number
) => {
  const size = Math.max(1, cellSize);
  const cellIndexX = Math.floor((x - originX) / size);
  const cellIndexY = Math.floor((y - originY) / size);
  const cellX = originX + cellIndexX * size;
  const cellY = originY + cellIndexY * size;

  return {
    cellX,
    cellY,
    centerX: cellX + size / 2,
    centerY: cellY + size / 2,
    key: `${cellIndexX}:${cellIndexY}`
  };
};

const getHexMetrics = (cellSize: number) => {
  const radius = Math.max(8, cellSize / 2);
  const hexWidth = Math.sqrt(3) * radius;
  const rowHeight = radius * 1.5;

  return {
    radius,
    hexWidth,
    rowHeight
  };
};

const getHexCell = (x: number, y: number, cellSize: number, originX: number, originY: number) => {
  const { hexWidth, rowHeight } = getHexMetrics(cellSize);
  const localX = x - originX;
  const localY = y - originY;
  const row = Math.round(localY / rowHeight);
  const rowOffset = row % 2 === 0 ? 0 : hexWidth / 2;
  const col = Math.round((localX - rowOffset) / hexWidth);

  const centerX = originX + col * hexWidth + rowOffset;
  const centerY = originY + row * rowHeight;

  return {
    centerX,
    centerY,
    key: `${col}:${row}`
  };
};

const snapToGrid = (x: number, y: number, settings: BoardSettings) => {
  if (settings.gridType === 'HEX') {
    return getHexCell(x, y, settings.cellSizePx, settings.gridOriginX, settings.gridOriginY);
  }

  return getSquareCell(x, y, settings.cellSizePx, settings.gridOriginX, settings.gridOriginY);
};

const drawHexPath = (
  graphics: Graphics,
  centerX: number,
  centerY: number,
  radius: number
): void => {
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = centerX + radius * Math.cos(angle);
    const py = centerY + radius * Math.sin(angle);

    if (i === 0) {
      graphics.moveTo(px, py);
    } else {
      graphics.lineTo(px, py);
    }
  }

  const firstAngle = (Math.PI / 180) * -30;
  graphics.lineTo(centerX + radius * Math.cos(firstAngle), centerY + radius * Math.sin(firstAngle));
};

const drawGrid = (graphics: Graphics, width: number, height: number, settings: BoardSettings) => {
  graphics.clear();

  if (settings.gridType === 'HEX') {
    const { radius, hexWidth, rowHeight } = getHexMetrics(settings.cellSizePx);
    const minRow = Math.floor((0 - settings.gridOriginY - radius) / rowHeight) - 2;
    const maxRow = Math.ceil((height - settings.gridOriginY + radius) / rowHeight) + 2;

    for (let row = minRow; row <= maxRow; row += 1) {
      const centerY = settings.gridOriginY + row * rowHeight;
      const rowOffset = row % 2 === 0 ? 0 : hexWidth / 2;
      const minCol = Math.floor((0 - settings.gridOriginX - rowOffset - radius) / hexWidth) - 2;
      const maxCol = Math.ceil((width - settings.gridOriginX - rowOffset + radius) / hexWidth) + 2;

      for (let col = minCol; col <= maxCol; col += 1) {
        const centerX = settings.gridOriginX + col * hexWidth + rowOffset;
        drawHexPath(graphics, centerX, centerY, radius);
      }
    }
  } else {
    const size = Math.max(1, settings.cellSizePx);
    const startX = ((settings.gridOriginX % size) + size) % size;
    const startY = ((settings.gridOriginY % size) + size) % size;

    for (let x = startX; x <= width; x += size) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }

    for (let y = startY; y <= height; y += size) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }
  }

  graphics.stroke({
    color: 0x334155,
    width: 1,
    alpha: 0.6
  });
};

const drawInteractionLayer = (graphics: Graphics, width: number, height: number): void => {
  graphics.clear();
  graphics.rect(0, 0, width, height);
  graphics.fill({
    color: 0xffffff,
    alpha: 0
  });
};

const drawHoverCell = (
  graphics: Graphics,
  snappedCell: {
    centerX: number;
    centerY: number;
  } | null,
  settings: BoardSettings
): void => {
  graphics.clear();

  if (!snappedCell) {
    return;
  }

  if (settings.gridType === 'HEX') {
    drawHexPath(
      graphics,
      snappedCell.centerX,
      snappedCell.centerY,
      Math.max(8, settings.cellSizePx / 2)
    );
  } else {
    const size = Math.max(1, settings.cellSizePx);
    graphics.rect(snappedCell.centerX - size / 2, snappedCell.centerY - size / 2, size, size);
  }

  graphics.fill({
    color: 0x93c5fd,
    alpha: 0.12
  });
  graphics.stroke({
    color: 0x93c5fd,
    alpha: 0.35,
    width: 1
  });
};

const loadTextureFromUrl = async (url: string): Promise<Texture> => {
  return new Promise<Texture>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      try {
        resolve(Texture.from(image));
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      reject(new Error(`Could not load image from ${url}`));
    };

    image.src = url;
  });
};

const getFanOffset = (args: {
  mode: StackDisplayMode;
  index: number;
  total: number;
  cellSizePx: number;
}): { x: number; y: number } => {
  if (args.mode === 'EXACT' || args.total <= 1) {
    return {
      x: 0,
      y: 0
    };
  }

  const radius = clamp(args.cellSizePx * 0.16, 6, 14);
  const angle = (Math.PI * 2 * args.index) / args.total - Math.PI / 2;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
};

const resolveCanvasCursor = (args: {
  boardSettings: BoardSettings;
  canEditMap: boolean;
  mapEditorTool: MapEditorTool;
}): string => {
  if (args.boardSettings.mapCalibrationMode) {
    return 'crosshair';
  }

  if (!args.boardSettings.mapEditMode) {
    return 'grab';
  }

  if (!args.canEditMap) {
    return 'default';
  }

  if (args.mapEditorTool === 'PAN' || args.mapEditorTool === 'PAN_MAP') {
    return 'grab';
  }

  if (args.mapEditorTool === 'SELECT') {
    return 'default';
  }

  if (args.mapEditorTool === 'DRAW' || args.mapEditorTool === 'ERASE') {
    return 'none';
  }

  if (args.mapEditorTool === 'TEXT') {
    return 'text';
  }

  return 'crosshair';
};

type MapEditorTool =
  | 'PAN'
  | 'PAN_MAP'
  | 'SELECT'
  | 'DRAW'
  | 'ERASE'
  | 'LINE'
  | 'RECT'
  | 'ELLIPSE'
  | 'IMAGE'
  | 'OBJECT'
  | 'TEXT';

type MapEditPoint = {
  x: number;
  y: number;
};
type MapEditPathElement = Extract<MapEditElement, { type: 'PATH' }>;
type MapEditLineElement = Extract<MapEditElement, { type: 'LINE' }>;
type MapEditRectElement = Extract<MapEditElement, { type: 'RECT' }>;
type MapEditEllipseElement = Extract<MapEditElement, { type: 'ELLIPSE' }>;
type MapEditImageElement = Extract<MapEditElement, { type: 'IMAGE' }>;
type MapEditTextElement = Extract<MapEditElement, { type: 'TEXT' }>;
type MapEditErasableElement = Exclude<MapEditElement, { type: 'ERASE_PATH' }>;

type PendingMapImage = {
  sourceUrl: string;
  imageRef: ImageRef;
  width: number;
  height: number;
  label: string;
} | null;

type MapEditGesture =
  | {
      kind: 'DRAW';
      pointerId: number;
      points: MapEditPoint[];
      brush: MapEditBrush;
    }
  | {
      kind: 'POLYLINE';
      points: MapEditPoint[];
      current: MapEditPoint;
    }
  | {
      kind: 'SHAPE';
      pointerId: number;
      tool: 'RECT' | 'ELLIPSE';
      start: MapEditPoint;
      current: MapEditPoint;
    }
  | {
      kind: 'ERASE';
      pointerId: number;
      points: MapEditPoint[];
    }
  | null;

type MapElementDragState = {
  pointerId: number;
  elementId: string;
  startPointer: MapEditPoint;
  startElementX: number;
  startElementY: number;
  snapshotBefore: MapEditElement[];
  moved: boolean;
} | null;

const cloneMapEditPoint = (point: MapEditPoint): MapEditPoint => ({
  x: point.x,
  y: point.y
});

const cloneMapEditEraseStrokes = (
  eraseStrokes: MapEditEraseStroke[] | undefined
): MapEditEraseStroke[] | undefined => {
  if (!eraseStrokes) {
    return undefined;
  }

  return eraseStrokes.map((stroke) => ({
    strokeWidth: stroke.strokeWidth,
    points: stroke.points.map((point) => cloneMapEditPoint(point))
  }));
};

const withClonedEraseStrokes = <T extends MapEditElement>(
  element: T,
  eraseStrokes: MapEditEraseStroke[] | undefined
): T => {
  if (!eraseStrokes || eraseStrokes.length === 0) {
    return element;
  }

  return {
    ...element,
    eraseStrokes
  };
};

const cloneMapEditElement = (element: MapEditElement): MapEditElement => {
  if (element.type === 'PATH' || element.type === 'ERASE_PATH') {
    return withClonedEraseStrokes(
      {
        ...element,
        points: element.points.map((point) => cloneMapEditPoint(point))
      },
      cloneMapEditEraseStrokes(element.eraseStrokes)
    );
  }

  if (element.type === 'LINE') {
    return withClonedEraseStrokes(
      {
        ...element,
        from: cloneMapEditPoint(element.from),
        to: cloneMapEditPoint(element.to)
      },
      cloneMapEditEraseStrokes(element.eraseStrokes)
    );
  }

  return withClonedEraseStrokes(
    {
      ...element
    },
    cloneMapEditEraseStrokes(element.eraseStrokes)
  );
};

const cloneMapEditElements = (elements: MapEditElement[]): MapEditElement[] => {
  return elements.map((element) => cloneMapEditElement(element));
};

const normalizeLegacyErasePaths = (elements: MapEditElement[]): MapEditElement[] => {
  const legacyErasePaths = elements.filter(
    (element): element is Extract<MapEditElement, { type: 'ERASE_PATH' }> =>
      element.type === 'ERASE_PATH'
  );

  if (legacyErasePaths.length === 0) {
    return elements;
  }

  const normalizedElements = elements
    .filter((element): element is MapEditErasableElement => element.type !== 'ERASE_PATH')
    .map((element) => cloneMapEditElement(element) as MapEditErasableElement);

  for (const legacyPath of legacyErasePaths) {
    const worldPoints = legacyPath.points.map((point) => ({
      x: legacyPath.x + point.x,
      y: legacyPath.y + point.y
    }));

    for (let index = 0; index < normalizedElements.length; index += 1) {
      const target = normalizedElements[index];
      if (!target) {
        continue;
      }

      const localStroke = buildLocalEraseStroke(target, worldPoints, legacyPath.strokeWidth);
      if (!localStroke || !doesEraseStrokeTouchElement(target, localStroke)) {
        continue;
      }

      const existingStrokes = target.eraseStrokes ?? [];
      const preservedStrokes =
        existingStrokes.length >= MAX_ERASE_STROKES_PER_ELEMENT
          ? existingStrokes.slice(existingStrokes.length - (MAX_ERASE_STROKES_PER_ELEMENT - 1))
          : existingStrokes;

      normalizedElements[index] = {
        ...target,
        eraseStrokes: [...preservedStrokes, localStroke]
      };
    }
  }

  return normalizedElements;
};

const applyMapEditOperations = (
  current: MapEditElement[],
  operations: MapEditOperation[]
): MapEditElement[] => {
  let next = current;

  for (const operation of operations) {
    if (operation.kind === 'CLEAR') {
      if (next.length !== 0) {
        next = [];
      }
      continue;
    }

    if (operation.kind === 'DELETE') {
      if (operation.elementIds.length === 0 || next.length === 0) {
        continue;
      }

      const ids = new Set(operation.elementIds);
      const filtered = next.filter((element) => !ids.has(element.id));
      if (filtered.length !== next.length) {
        next = filtered;
      }
      continue;
    }

    if (operation.elements.length === 0) {
      continue;
    }

    const indexById = new Map<string, number>();
    next.forEach((element, index) => {
      indexById.set(element.id, index);
    });

    let updated = false;
    const copy = [...next];

    for (const element of operation.elements) {
      const existingIndex = indexById.get(element.id);
      const cloned = cloneMapEditElement(element);
      if (existingIndex === undefined) {
        copy.push(cloned);
      } else {
        copy[existingIndex] = cloned;
      }
      updated = true;
    }

    if (updated) {
      next = copy;
    }
  }

  return next;
};

const areMapEditElementsEqual = (left: MapEditElement, right: MapEditElement): boolean => {
  return JSON.stringify(left) === JSON.stringify(right);
};

const buildMapEditOperationsDiff = (
  before: MapEditElement[],
  after: MapEditElement[]
): MapEditOperation[] => {
  if (before.length > 0 && after.length === 0) {
    return [{ kind: 'CLEAR' }];
  }

  const beforeById = new Map(before.map((element) => [element.id, element]));
  const afterById = new Map(after.map((element) => [element.id, element]));

  const deletedIds: string[] = [];
  for (const element of before) {
    if (!afterById.has(element.id)) {
      deletedIds.push(element.id);
    }
  }

  const upsertElements: MapEditElement[] = [];
  for (const element of after) {
    const previous = beforeById.get(element.id);
    if (!previous || !areMapEditElementsEqual(previous, element)) {
      upsertElements.push(cloneMapEditElement(element));
    }
  }

  const operations: MapEditOperation[] = [];
  if (upsertElements.length > 0) {
    operations.push({
      kind: 'UPSERT',
      elements: upsertElements
    });
  }

  if (deletedIds.length > 0) {
    operations.push({
      kind: 'DELETE',
      elementIds: deletedIds
    });
  }

  return operations;
};

const mapEditBrushAlphaFactor: Record<MapEditBrush, number> = {
  PEN: 1,
  MARKER: 0.55,
  CHALK: 0.8
};

const appendBrushPoints = (
  points: MapEditPoint[],
  nextPoint: MapEditPoint,
  spacing: number
): boolean => {
  const lastPoint = points[points.length - 1];
  if (!lastPoint) {
    points.push(nextPoint);
    return true;
  }

  const distance = Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y);
  if (distance < 0.2) {
    return false;
  }

  const step = Math.max(0.5, spacing);
  const stepCount = Math.floor(distance / step);
  for (let index = 1; index <= stepCount; index += 1) {
    const t = (index * step) / distance;
    if (t >= 1) {
      break;
    }

    points.push({
      x: lastPoint.x + (nextPoint.x - lastPoint.x) * t,
      y: lastPoint.y + (nextPoint.y - lastPoint.y) * t
    });
  }

  points.push(nextPoint);
  return true;
};

const limitPointCount = (points: MapEditPoint[], limit: number): MapEditPoint[] => {
  if (points.length <= limit) {
    return points.map((point) => cloneMapEditPoint(point));
  }

  const step = Math.ceil(points.length / limit);
  const reduced: MapEditPoint[] = [];
  for (let index = 0; index < points.length; index += step) {
    const point = points[index];
    if (!point) {
      continue;
    }

    reduced.push(cloneMapEditPoint(point));
  }

  const lastPoint = points[points.length - 1];
  if (lastPoint && (reduced.length === 0 || reduced[reduced.length - 1] !== lastPoint)) {
    const lastReduced = reduced[reduced.length - 1];
    if (
      !lastReduced ||
      Math.abs(lastReduced.x - lastPoint.x) > 0.001 ||
      Math.abs(lastReduced.y - lastPoint.y) > 0.001
    ) {
      reduced.push(cloneMapEditPoint(lastPoint));
    }
  }

  return reduced;
};

const isErasableMapEditElement = (element: MapEditElement): element is MapEditErasableElement => {
  return element.type !== 'ERASE_PATH';
};

const toLocalElementPoint = (element: MapEditElement, worldPoint: MapEditPoint): MapEditPoint => {
  const safeScale = Math.max(0.05, Math.abs(element.scale));
  const rad = degToRad(element.rotationDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = worldPoint.x - element.x;
  const dy = worldPoint.y - element.y;

  return {
    x: (dx * cos + dy * sin) / safeScale,
    y: (-dx * sin + dy * cos) / safeScale
  };
};

const buildLocalEraseStroke = (
  element: MapEditElement,
  worldPoints: MapEditPoint[],
  worldStrokeWidth: number
): MapEditEraseStroke | null => {
  if (worldPoints.length === 0) {
    return null;
  }

  const safeScale = Math.max(0.05, Math.abs(element.scale));
  const localStrokeWidth = clamp(worldStrokeWidth / safeScale, 1, 128);

  return {
    strokeWidth: localStrokeWidth,
    points: limitPointCount(
      worldPoints.map((point) => toLocalElementPoint(element, point)),
      MAX_POINTS_PER_ERASE_STROKE
    )
  };
};

const doesEraseStrokeTouchElement = (
  element: MapEditElement,
  stroke: MapEditEraseStroke
): boolean => {
  if (stroke.points.length === 0) {
    return false;
  }

  const bounds = getMapEditElementLocalBounds(element);
  const radius = stroke.strokeWidth / 2;
  const minX = bounds.minX - radius;
  const maxX = bounds.minX + bounds.width + radius;
  const minY = bounds.minY - radius;
  const maxY = bounds.minY + bounds.height + radius;

  return stroke.points.some(
    (point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
  );
};

const measureMapEditText = (args: {
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  align: MapTextAlign;
}) => {
  const probe = new Text({
    text: args.text,
    style: {
      fill: args.color,
      fontSize: args.fontSize,
      fontFamily: args.fontFamily,
      lineHeight: args.fontSize * args.lineHeight,
      align: args.align
    }
  });

  const measured = {
    width: Math.max(1, probe.width),
    height: Math.max(1, probe.height)
  };

  probe.destroy();
  return measured;
};

const buildPathElement = (args: {
  points: MapEditPoint[];
  color: string;
  strokeWidth: number;
  brush: MapEditBrush;
}): MapEditPathElement | null => {
  if (args.points.length < 2) {
    return null;
  }

  const minX = Math.min(...args.points.map((point) => point.x));
  const maxX = Math.max(...args.points.map((point) => point.x));
  const minY = Math.min(...args.points.map((point) => point.y));
  const maxY = Math.max(...args.points.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    id: createMapEditId(),
    type: 'PATH',
    x: centerX,
    y: centerY,
    rotationDeg: 0,
    scale: 1,
    opacity: 1,
    color: args.color,
    strokeWidth: clamp(args.strokeWidth, 1, 64),
    brush: args.brush,
    points: args.points.map((point) => ({
      x: point.x - centerX,
      y: point.y - centerY
    }))
  };
};

const buildLineElement = (args: {
  start: MapEditPoint;
  end: MapEditPoint;
  color: string;
  strokeWidth: number;
}): MapEditLineElement | null => {
  const dx = args.end.x - args.start.x;
  const dy = args.end.y - args.start.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 2) {
    return null;
  }

  const centerX = (args.start.x + args.end.x) / 2;
  const centerY = (args.start.y + args.end.y) / 2;

  return {
    id: createMapEditId(),
    type: 'LINE',
    x: centerX,
    y: centerY,
    rotationDeg: 0,
    scale: 1,
    opacity: 1,
    color: args.color,
    strokeWidth: clamp(args.strokeWidth, 1, 64),
    from: {
      x: args.start.x - centerX,
      y: args.start.y - centerY
    },
    to: {
      x: args.end.x - centerX,
      y: args.end.y - centerY
    }
  };
};

const toWorldElementPoint = (element: MapEditElement, localPoint: MapEditPoint): MapEditPoint => {
  const scale = element.scale;
  const rad = degToRad(element.rotationDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    x: element.x + (localPoint.x * cos - localPoint.y * sin) * scale,
    y: element.y + (localPoint.x * sin + localPoint.y * cos) * scale
  };
};

const collectMapEditSnapNodes = (elements: MapEditElement[], limit = 1200): MapEditPoint[] => {
  const nodes: MapEditPoint[] = [];
  const pushNode = (point: MapEditPoint) => {
    if (nodes.length >= limit) {
      return;
    }

    nodes.push(point);
  };

  for (const element of elements) {
    if (nodes.length >= limit) {
      break;
    }

    if (element.type === 'ERASE_PATH') {
      continue;
    }

    if (element.type === 'LINE') {
      pushNode(toWorldElementPoint(element, element.from));
      pushNode(toWorldElementPoint(element, element.to));
      continue;
    }

    if (element.type === 'PATH') {
      for (const point of element.points) {
        pushNode(toWorldElementPoint(element, point));
        if (nodes.length >= limit) {
          break;
        }
      }
      continue;
    }

    const halfWidth = element.width / 2;
    const halfHeight = element.height / 2;
    pushNode(toWorldElementPoint(element, { x: -halfWidth, y: -halfHeight }));
    pushNode(toWorldElementPoint(element, { x: halfWidth, y: -halfHeight }));
    pushNode(toWorldElementPoint(element, { x: halfWidth, y: halfHeight }));
    pushNode(toWorldElementPoint(element, { x: -halfWidth, y: halfHeight }));
  }

  return nodes;
};

const normalizeAngle = (angle: number): number => {
  let next = angle;
  while (next > Math.PI) {
    next -= Math.PI * 2;
  }
  while (next < -Math.PI) {
    next += Math.PI * 2;
  }

  return next;
};

const maybeSnapToOrthogonal = (
  anchor: MapEditPoint,
  target: MapEditPoint,
  maxAngleDeltaDeg: number
): MapEditPoint | null => {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return null;
  }

  const angle = Math.atan2(dy, dx);
  const nearestAxisAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  const delta = Math.abs(normalizeAngle(angle - nearestAxisAngle));
  if (delta > degToRad(maxAngleDeltaDeg)) {
    return null;
  }

  const horizontal = Math.abs(Math.sin(nearestAxisAngle)) < 0.001;
  if (horizontal) {
    return {
      x: target.x,
      y: anchor.y
    };
  }

  return {
    x: anchor.x,
    y: target.y
  };
};

const findNearestSnapNode = (
  origin: MapEditPoint,
  nodes: MapEditPoint[],
  maxDistance: number
): MapEditPoint | null => {
  let nearest: MapEditPoint | null = null;
  let nearestDistance = maxDistance;

  for (const node of nodes) {
    const distance = Math.hypot(node.x - origin.x, node.y - origin.y);
    if (distance <= nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }

  return nearest ? cloneMapEditPoint(nearest) : null;
};

const buildRectElement = (args: {
  start: MapEditPoint;
  end: MapEditPoint;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}): MapEditRectElement | null => {
  const width = Math.abs(args.end.x - args.start.x);
  const height = Math.abs(args.end.y - args.start.y);

  if (width < 2 || height < 2) {
    return null;
  }

  return {
    id: createMapEditId(),
    type: 'RECT',
    x: (args.start.x + args.end.x) / 2,
    y: (args.start.y + args.end.y) / 2,
    rotationDeg: 0,
    scale: 1,
    opacity: 1,
    strokeColor: args.strokeColor,
    fillColor: args.fillColor,
    strokeWidth: clamp(args.strokeWidth, 1, 64),
    width,
    height
  };
};

const buildEllipseElement = (args: {
  start: MapEditPoint;
  end: MapEditPoint;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}): MapEditEllipseElement | null => {
  const width = Math.abs(args.end.x - args.start.x);
  const height = Math.abs(args.end.y - args.start.y);

  if (width < 2 || height < 2) {
    return null;
  }

  return {
    id: createMapEditId(),
    type: 'ELLIPSE',
    x: (args.start.x + args.end.x) / 2,
    y: (args.start.y + args.end.y) / 2,
    rotationDeg: 0,
    scale: 1,
    opacity: 1,
    strokeColor: args.strokeColor,
    fillColor: args.fillColor,
    strokeWidth: clamp(args.strokeWidth, 1, 64),
    width,
    height
  };
};

const buildTextElement = (args: {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  align: MapTextAlign;
}): MapEditTextElement | null => {
  if (!args.text.trim()) {
    return null;
  }

  const fontFamily = sanitizeFontFamily(args.fontFamily);
  const metrics = measureMapEditText({
    text: args.text,
    color: args.color,
    fontSize: clamp(args.fontSize, 8, 240),
    fontFamily,
    lineHeight: clamp(args.lineHeight, 0.7, 4),
    align: args.align
  });

  return {
    id: createMapEditId(),
    type: 'TEXT',
    x: args.x,
    y: args.y,
    rotationDeg: 0,
    scale: 1,
    opacity: 1,
    text: args.text,
    color: args.color,
    fontSize: clamp(args.fontSize, 8, 240),
    fontFamily,
    lineHeight: clamp(args.lineHeight, 0.7, 4),
    align: args.align,
    width: Math.max(1, metrics.width),
    height: Math.max(1, metrics.height)
  };
};

const getMapEditElementLocalBounds = (
  element: MapEditElement
): { minX: number; minY: number; width: number; height: number } => {
  if (
    element.type === 'RECT' ||
    element.type === 'ELLIPSE' ||
    element.type === 'IMAGE' ||
    element.type === 'TEXT'
  ) {
    return {
      minX: -element.width / 2,
      minY: -element.height / 2,
      width: element.width,
      height: element.height
    };
  }

  if (element.type === 'LINE') {
    const minX = Math.min(element.from.x, element.to.x) - element.strokeWidth;
    const minY = Math.min(element.from.y, element.to.y) - element.strokeWidth;
    const maxX = Math.max(element.from.x, element.to.x) + element.strokeWidth;
    const maxY = Math.max(element.from.y, element.to.y) + element.strokeWidth;
    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  const minX = Math.min(...element.points.map((point) => point.x)) - element.strokeWidth;
  const minY = Math.min(...element.points.map((point) => point.y)) - element.strokeWidth;
  const maxX = Math.max(...element.points.map((point) => point.x)) + element.strokeWidth;
  const maxY = Math.max(...element.points.map((point) => point.y)) + element.strokeWidth;

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

type BoardCanvasProps = {
  mapImageUrl: string | null;
  tokens: VttToken[];
  canCreateToken: boolean;
  canEditToken: (token: VttToken) => boolean;
  canEditMap: boolean;
  optimisticMapEdit: boolean;
  mapEditSnapshot: MapEditSnapshot;
  mapEditRemoteEvents: MapEditOpsAppliedMessage['payload'][];
  canMoveToken: (token: VttToken) => boolean;
  boardSettings: BoardSettings;
  resolveAssetUrl: (assetId: string) => string | null;
  onBoardSettingsChange: (patch: Partial<BoardSettings>) => void;
  onMapCalibrationPoint?: (point: { x: number; y: number }) => void;
  prepareMapEditImageAsset?: (
    file: File,
    kind: 'MAP_EDIT_IMAGE' | 'OBJECT'
  ) => Promise<{ imageRef: ImageRef; sourceUrl: string } | null>;
  onCreateToken: (
    x: number,
    y: number,
    draft: TokenDraft,
    imageFile?: File | null
  ) => Promise<void> | void;
  onUpdateToken: (
    tokenId: string,
    draft: TokenDraft,
    imageFile?: File | null
  ) => Promise<void> | void;
  onDeleteToken?: (tokenId: string) => void;
  tokenEditRequest?: {
    tokenId: string;
    requestId: string;
  } | null;
  onMoveToken: (tokenId: string, x: number, y: number, options: { final: boolean }) => void;
  onMapEditOperations: (operations: MapEditOperation[], options?: { immediate?: boolean }) => void;
};

type DragState = {
  tokenId: string;
  offsetX: number;
  offsetY: number;
};

type PanState = {
  active: boolean;
  pointerId: number | null;
  lastGlobalX: number;
  lastGlobalY: number;
  mode: 'BOARD' | 'MAP';
};

type ContextMenuState = {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  tokenId: string | null;
} | null;

type TokenModalState = {
  mode: 'CREATE' | 'EDIT';
  tokenId: string | null;
  worldX: number;
  worldY: number;
  draft: TokenDraft;
  imageFile: File | null;
  existingImageUrl: string | null;
  hasCustomColor: boolean;
} | null;

type TokenPreviewDimensions = {
  width: number;
  height: number;
} | null;

type TextEditorState = {
  mode: 'CREATE' | 'EDIT';
  elementId: string | null;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  lineHeight: number;
  align: MapTextAlign;
  panelLeft: number | null;
  panelTop: number | null;
} | null;

export const BoardCanvas = ({
  mapImageUrl,
  tokens,
  canCreateToken,
  canEditToken,
  canEditMap,
  optimisticMapEdit,
  mapEditSnapshot,
  mapEditRemoteEvents,
  canMoveToken,
  boardSettings,
  resolveAssetUrl,
  onBoardSettingsChange,
  onMapCalibrationPoint,
  prepareMapEditImageAsset,
  onCreateToken,
  onUpdateToken,
  onDeleteToken,
  tokenEditRequest,
  onMoveToken,
  onMapEditOperations
}: BoardCanvasProps) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const mapLayerRef = useRef<Container | null>(null);
  const mapEditLayerRef = useRef<Container | null>(null);
  const mapEditPreviewRef = useRef<Graphics | null>(null);
  const mapEditBrushCursorRef = useRef<Graphics | null>(null);
  const mapSpriteRef = useRef<Sprite | null>(null);
  const interactionLayerRef = useRef<Graphics | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const hoverRef = useRef<Graphics | null>(null);
  const tokenLayerRef = useRef<Container | null>(null);
  const tokenTextureCacheRef = useRef<Map<string, Texture>>(new Map());
  const mapEditTextureCacheRef = useRef<Map<string, Texture>>(new Map());
  const mapEditTextureLoadingRef = useRef<Set<string>>(new Set());
  const mapEditObjectUrlsRef = useRef<Set<string>>(new Set());
  const mapImageInputRef = useRef<HTMLInputElement | null>(null);
  const mapObjectInputRef = useRef<HTMLInputElement | null>(null);

  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState>({
    active: false,
    pointerId: null,
    lastGlobalX: 0,
    lastGlobalY: 0,
    mode: 'BOARD'
  });
  const hoveredCellRef = useRef<{ centerX: number; centerY: number } | null>(null);
  const mapEditGestureRef = useRef<MapEditGesture>(null);
  const mapElementDragRef = useRef<MapElementDragState>(null);
  const mapEditUndoStackRef = useRef<MapEditElement[][]>([]);
  const mapEditRedoStackRef = useRef<MapEditElement[][]>([]);
  const mapEditElementsRef = useRef<MapEditElement[]>([]);
  const mapEditRevisionRef = useRef(0);
  const processedRemoteMapEventsRef = useRef(0);
  const previousMapEditorToolRef = useRef<MapEditorTool>('PAN');

  const mapSizeRef = useRef<{ width: number; height: number } | null>(null);
  const refreshBoardVisualsRef = useRef<(() => void) | null>(null);
  const applyMapTransformRef = useRef<(() => void) | null>(null);
  const isAppInitializedRef = useRef(false);
  const boardSettingsRef = useRef(boardSettings);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [tokenModal, setTokenModal] = useState<TokenModalState>(null);
  const [tokenPreviewUrl, setTokenPreviewUrl] = useState<string | null>(null);
  const [tokenPreviewDimensions, setTokenPreviewDimensions] =
    useState<TokenPreviewDimensions>(null);
  const [isSubmittingToken, setIsSubmittingToken] = useState(false);
  const [tokenFormError, setTokenFormError] = useState<string | null>(null);
  const [mapEditorTool, setMapEditorTool] = useState<MapEditorTool>('PAN');
  const [mapEditorStrokeColor, setMapEditorStrokeColor] = useState('#38bdf8');
  const [mapEditorFillColor, setMapEditorFillColor] = useState('#38bdf8');
  const [mapEditorStrokeWidth, setMapEditorStrokeWidth] = useState(6);
  const [mapEditorBrush, setMapEditorBrush] = useState<MapEditBrush>(DEFAULT_BRUSH_PRESET);
  const [mapEditorTextSize, setMapEditorTextSize] = useState(28);
  const [mapEditorTextFontFamily, setMapEditorTextFontFamily] = useState(DEFAULT_TEXT_FONT);
  const [mapEditorTextLineHeight, setMapEditorTextLineHeight] = useState(1.2);
  const [mapEditorTextAlign, setMapEditorTextAlign] = useState<MapTextAlign>('left');
  const [mapEditElements, setMapEditElements] = useState<MapEditElement[]>([]);
  const [mapEditTexturesVersion, setMapEditTexturesVersion] = useState(0);
  const [pendingMapImage, setPendingMapImage] = useState<PendingMapImage>(null);
  const [mapObjectLibrary, setMapObjectLibrary] = useState<MapObjectLibraryItem[]>(() =>
    loadStoredMapObjectLibrary()
  );
  const [selectedMapObjectId, setSelectedMapObjectId] = useState<string>(
    () => DEFAULT_MAP_OBJECT_LIBRARY[0]?.id ?? ''
  );
  const [selectedMapEditElementId, setSelectedMapEditElementId] = useState<string | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState>(null);
  const handledTokenEditRequestRef = useRef<string | null>(null);
  const mapEditorToolRef = useRef(mapEditorTool);
  const mapEditorStrokeColorRef = useRef(mapEditorStrokeColor);
  const mapEditorFillColorRef = useRef(mapEditorFillColor);
  const mapEditorStrokeWidthRef = useRef(mapEditorStrokeWidth);
  const mapEditorBrushRef = useRef(mapEditorBrush);
  const mapEditorTextSizeRef = useRef(mapEditorTextSize);
  const mapEditorTextFontFamilyRef = useRef(mapEditorTextFontFamily);
  const mapEditorTextLineHeightRef = useRef(mapEditorTextLineHeight);
  const mapEditorTextAlignRef = useRef(mapEditorTextAlign);
  const pendingMapImageRef = useRef<PendingMapImage>(pendingMapImage);
  const mapObjectLibraryRef = useRef<MapObjectLibraryItem[]>(mapObjectLibrary);
  const selectedMapObjectIdRef = useRef(selectedMapObjectId);
  const textEditorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textEditorDragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const callbacksRef = useRef({
    canMoveToken,
    canCreateToken,
    canEditToken,
    canEditMap,
    optimisticMapEdit,
    onBoardSettingsChange,
    onMapCalibrationPoint,
    prepareMapEditImageAsset,
    onCreateToken,
    onUpdateToken,
    onDeleteToken,
    onMoveToken,
    onMapEditOperations,
    resolveAssetUrl
  });

  callbacksRef.current = {
    canMoveToken,
    canCreateToken,
    canEditToken,
    canEditMap,
    optimisticMapEdit,
    onBoardSettingsChange,
    onMapCalibrationPoint,
    prepareMapEditImageAsset,
    onCreateToken,
    onUpdateToken,
    onDeleteToken,
    onMoveToken,
    onMapEditOperations,
    resolveAssetUrl
  };
  boardSettingsRef.current = boardSettings;
  mapEditorToolRef.current = mapEditorTool;
  mapEditorStrokeColorRef.current = mapEditorStrokeColor;
  mapEditorFillColorRef.current = mapEditorFillColor;
  mapEditorStrokeWidthRef.current = mapEditorStrokeWidth;
  mapEditorBrushRef.current = mapEditorBrush;
  mapEditorTextSizeRef.current = mapEditorTextSize;
  mapEditorTextFontFamilyRef.current = mapEditorTextFontFamily;
  mapEditorTextLineHeightRef.current = mapEditorTextLineHeight;
  mapEditorTextAlignRef.current = mapEditorTextAlign;
  pendingMapImageRef.current = pendingMapImage;
  mapObjectLibraryRef.current = mapObjectLibrary;
  selectedMapObjectIdRef.current = selectedMapObjectId;
  mapEditElementsRef.current = mapEditElements;

  const mapInstruction = useMemo(() => {
    if (boardSettings.mapCalibrationMode) {
      return 'Calibration mode: Left click two adjacent map-grid corners, middle drag pans, wheel zooms';
    }

    if (!boardSettings.mapEditMode) {
      return 'Wheel: zoom board, Left/Middle drag: pan board, Right click: token menu';
    }

    if (!canEditMap) {
      return 'Map edit mode is active but your role is currently read-only.';
    }

    if (mapEditorTool === 'PAN') {
      return 'Map edit: drag to pan the viewport, wheel zooms board.';
    }

    if (mapEditorTool === 'PAN_MAP') {
      return 'Map edit: drag to pan only the background map.';
    }

    if (mapEditorTool === 'SELECT') {
      return 'Map edit: click object to select, drag to move, use toolbar controls for scale/rotation.';
    }

    if (mapEditorTool === 'ERASE') {
      return 'Map edit: erase with brush. Ctrl + mouse wheel changes eraser size.';
    }

    if (mapEditorTool === 'LINE') {
      return 'Map edit: polyline mode. Click to add nodes, Esc to finish. Near 90deg and nearby nodes will snap.';
    }

    if (mapEditorTool === 'IMAGE') {
      return pendingMapImage
        ? 'Map edit: click on the board to place the selected image.'
        : 'Map edit: load an image first, then click to place it.';
    }

    if (mapEditorTool === 'OBJECT') {
      return 'Map edit: select an object from the library and click on the board to place it.';
    }

    if (mapEditorTool === 'TEXT') {
      return 'Map edit: click to start typing. Existing text can be edited by clicking it.';
    }

    return 'Map edit: draw directly on the board. Ctrl + mouse wheel changes brush size.';
  }, [
    boardSettings.mapCalibrationMode,
    boardSettings.mapEditMode,
    canEditMap,
    mapEditorTool,
    pendingMapImage
  ]);

  const tokenPreviewFrame = useMemo(() => {
    if (!tokenModal || !tokenPreviewDimensions) {
      return null;
    }

    const textureWidth = Math.max(1, tokenPreviewDimensions.width);
    const textureHeight = Math.max(1, tokenPreviewDimensions.height);
    const coverScale = TOKEN_PREVIEW_DIAMETER / Math.min(textureWidth, textureHeight);
    const customScale = Number.isFinite(tokenModal.draft.imageScale)
      ? tokenModal.draft.imageScale
      : 1;
    const offsetX = Number.isFinite(tokenModal.draft.imageOffsetX)
      ? tokenModal.draft.imageOffsetX
      : 0;
    const offsetY = Number.isFinite(tokenModal.draft.imageOffsetY)
      ? tokenModal.draft.imageOffsetY
      : 0;
    const rotationDeg = Number.isFinite(tokenModal.draft.imageRotationDeg)
      ? tokenModal.draft.imageRotationDeg
      : 0;
    const finalScale = coverScale * customScale;

    return {
      width: textureWidth * finalScale,
      height: textureHeight * finalScale,
      offsetX,
      offsetY,
      rotationDeg
    };
  }, [
    tokenModal,
    tokenModal?.draft.imageOffsetX,
    tokenModal?.draft.imageOffsetY,
    tokenModal?.draft.imageRotationDeg,
    tokenModal?.draft.imageScale,
    tokenPreviewDimensions
  ]);

  const selectedMapEditElement = useMemo(() => {
    if (!selectedMapEditElementId) {
      return null;
    }

    return mapEditElements.find((element) => element.id === selectedMapEditElementId) ?? null;
  }, [mapEditElements, selectedMapEditElementId]);

  const selectedMapObject = useMemo(() => {
    if (mapObjectLibrary.length === 0) {
      return null;
    }

    return (
      mapObjectLibrary.find((entry) => entry.id === selectedMapObjectId) ?? mapObjectLibrary[0]
    );
  }, [mapObjectLibrary, selectedMapObjectId]);

  const openTextEditorForCreate = useCallback(
    (args: { worldX: number; worldY: number; screenX: number; screenY: number }) => {
      setSelectedMapEditElementId(null);
      setTextEditor({
        mode: 'CREATE',
        elementId: null,
        worldX: args.worldX,
        worldY: args.worldY,
        screenX: args.screenX,
        screenY: args.screenY,
        text: '',
        fontSize: clamp(mapEditorTextSizeRef.current, 8, 240),
        color: mapEditorStrokeColorRef.current,
        fontFamily: sanitizeFontFamily(mapEditorTextFontFamilyRef.current),
        lineHeight: clamp(mapEditorTextLineHeightRef.current, 0.7, 4),
        align: mapEditorTextAlignRef.current,
        panelLeft: null,
        panelTop: null
      });
    },
    []
  );

  const openTextEditorForExisting = useCallback(
    (args: { element: MapEditTextElement; screenX: number; screenY: number }) => {
      setSelectedMapEditElementId(args.element.id);
      setTextEditor({
        mode: 'EDIT',
        elementId: args.element.id,
        worldX: args.element.x,
        worldY: args.element.y,
        screenX: args.screenX,
        screenY: args.screenY,
        text: args.element.text,
        fontSize: args.element.fontSize,
        color: args.element.color,
        fontFamily: sanitizeFontFamily(args.element.fontFamily),
        lineHeight: args.element.lineHeight,
        align: args.element.align,
        panelLeft: null,
        panelTop: null
      });
    },
    []
  );

  const closeTextEditor = useCallback(() => {
    textEditorDragRef.current = null;
    setTextEditor(null);
  }, []);

  const getEditorScreenPointFromWorld = useCallback((worldX: number, worldY: number) => {
    const world = worldRef.current;
    const app = appRef.current;
    if (!world || !app) {
      return null;
    }

    const canvasRect = app.canvas.getBoundingClientRect();
    const globalPoint = world.toGlobal({
      x: worldX,
      y: worldY
    });

    return {
      x: globalPoint.x - canvasRect.left,
      y: globalPoint.y - canvasRect.top
    };
  }, []);

  const syncTextEditorScreenPosition = useCallback(() => {
    setTextEditor((previous) => {
      if (!previous) {
        return previous;
      }

      const nextScreen = getEditorScreenPointFromWorld(previous.worldX, previous.worldY);
      if (!nextScreen) {
        return previous;
      }

      if (
        Math.abs(previous.screenX - nextScreen.x) < 0.5 &&
        Math.abs(previous.screenY - nextScreen.y) < 0.5
      ) {
        return previous;
      }

      return {
        ...previous,
        screenX: nextScreen.x,
        screenY: nextScreen.y
      };
    });
  }, [getEditorScreenPointFromWorld]);

  useEffect(() => {
    mapEditRevisionRef.current = mapEditSnapshot.revision;
    processedRemoteMapEventsRef.current = 0;
    setMapEditElements(normalizeLegacyErasePaths(cloneMapEditElements(mapEditSnapshot.elements)));
    mapEditUndoStackRef.current = [];
    mapEditRedoStackRef.current = [];
    setSelectedMapEditElementId(null);
    setTextEditor(null);
    mapEditGestureRef.current = null;
    mapElementDragRef.current = null;
    mapEditPreviewRef.current?.clear();
    mapEditBrushCursorRef.current?.clear();
  }, [mapEditSnapshot]);

  useEffect(() => {
    if (processedRemoteMapEventsRef.current > mapEditRemoteEvents.length) {
      processedRemoteMapEventsRef.current = 0;
    }

    if (processedRemoteMapEventsRef.current === mapEditRemoteEvents.length) {
      return;
    }

    const unprocessed = mapEditRemoteEvents.slice(processedRemoteMapEventsRef.current);
    processedRemoteMapEventsRef.current = mapEditRemoteEvents.length;

    setMapEditElements((current) => {
      let next = current;
      for (const event of unprocessed) {
        if (event.revision <= mapEditRevisionRef.current) {
          continue;
        }

        next = normalizeLegacyErasePaths(applyMapEditOperations(next, event.operations));
        mapEditRevisionRef.current = event.revision;
      }

      return next;
    });
  }, [mapEditRemoteEvents]);

  const pushMapEditUndoSnapshot = useCallback((snapshot: MapEditElement[]) => {
    mapEditUndoStackRef.current.push(cloneMapEditElements(snapshot));

    if (mapEditUndoStackRef.current.length > MAP_EDIT_HISTORY_LIMIT) {
      mapEditUndoStackRef.current.shift();
    }
  }, []);

  const commitMapEditOperations = useCallback(
    (operations: MapEditOperation[], options?: { immediate?: boolean }) => {
      if (operations.length === 0) {
        return;
      }

      if (!callbacksRef.current.optimisticMapEdit) {
        callbacksRef.current.onMapEditOperations(operations, options);
        return;
      }

      setMapEditElements((previous) => {
        const next = applyMapEditOperations(previous, operations);

        if (next === previous) {
          return previous;
        }

        pushMapEditUndoSnapshot(previous);
        mapEditRedoStackRef.current = [];
        return next;
      });
      callbacksRef.current.onMapEditOperations(operations, options);
    },
    [pushMapEditUndoSnapshot]
  );

  const applyEraseGestureToElements = useCallback(
    (worldPoints: MapEditPoint[]) => {
      if (worldPoints.length === 0) {
        return;
      }

      const worldStrokeWidth = clamp(mapEditorStrokeWidthRef.current, 1, 64);
      const updatedElements: MapEditErasableElement[] = [];

      for (const element of mapEditElementsRef.current) {
        if (!isErasableMapEditElement(element)) {
          continue;
        }

        const localStroke = buildLocalEraseStroke(element, worldPoints, worldStrokeWidth);
        if (!localStroke || !doesEraseStrokeTouchElement(element, localStroke)) {
          continue;
        }

        const existingStrokes = element.eraseStrokes ?? [];
        const preservedStrokes =
          existingStrokes.length >= MAX_ERASE_STROKES_PER_ELEMENT
            ? existingStrokes.slice(existingStrokes.length - (MAX_ERASE_STROKES_PER_ELEMENT - 1))
            : existingStrokes;

        updatedElements.push({
          ...element,
          eraseStrokes: [...preservedStrokes, localStroke]
        });
      }

      if (updatedElements.length === 0) {
        return;
      }

      commitMapEditOperations(
        [
          {
            kind: 'UPSERT',
            elements: updatedElements
          }
        ],
        {
          immediate: true
        }
      );
    },
    [commitMapEditOperations]
  );

  const applyTextEditorChanges = useCallback(() => {
    if (!textEditor) {
      return;
    }

    const normalizedText = textEditor.text.replace(/\r\n/g, '\n');
    if (!normalizedText.trim()) {
      setTextEditor(null);
      return;
    }

    const safeFontSize = clamp(textEditor.fontSize, 8, 240);
    const safeFontFamily = sanitizeFontFamily(textEditor.fontFamily);
    const safeLineHeight = clamp(textEditor.lineHeight, 0.7, 4);
    const measured = measureMapEditText({
      text: normalizedText,
      color: textEditor.color,
      fontSize: safeFontSize,
      fontFamily: safeFontFamily,
      lineHeight: safeLineHeight,
      align: textEditor.align
    });

    setMapEditorTextSize(safeFontSize);
    setMapEditorTextFontFamily(safeFontFamily);
    setMapEditorTextLineHeight(safeLineHeight);
    setMapEditorTextAlign(textEditor.align);
    setMapEditorStrokeColor(textEditor.color);

    if (textEditor.mode === 'EDIT' && textEditor.elementId) {
      const existing = mapEditElementsRef.current.find(
        (entry): entry is MapEditTextElement =>
          entry.id === textEditor.elementId && entry.type === 'TEXT'
      );

      if (!existing) {
        setTextEditor(null);
        return;
      }

      commitMapEditOperations(
        [
          {
            kind: 'UPSERT',
            elements: [
              {
                ...existing,
                text: normalizedText,
                color: textEditor.color,
                fontSize: safeFontSize,
                fontFamily: safeFontFamily,
                lineHeight: safeLineHeight,
                align: textEditor.align,
                width: measured.width,
                height: measured.height
              }
            ]
          }
        ],
        {
          immediate: true
        }
      );
      setSelectedMapEditElementId(existing.id);
      setTextEditor(null);
      return;
    }

    const created = buildTextElement({
      x: textEditor.worldX,
      y: textEditor.worldY,
      text: normalizedText,
      color: textEditor.color,
      fontSize: safeFontSize,
      fontFamily: safeFontFamily,
      lineHeight: safeLineHeight,
      align: textEditor.align
    });

    if (!created) {
      setTextEditor(null);
      return;
    }

    commitMapEditOperations(
      [
        {
          kind: 'UPSERT',
          elements: [created]
        }
      ],
      {
        immediate: true
      }
    );
    setSelectedMapEditElementId(created.id);
    setTextEditor(null);
  }, [commitMapEditOperations, textEditor]);

  useEffect(() => {
    if (!textEditor) {
      return;
    }

    const timer = window.setTimeout(() => {
      const textarea = textEditorTextareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [textEditor]);

  useEffect(() => {
    if (!textEditor) {
      return;
    }

    let frameId = 0;
    const tick = () => {
      syncTextEditorScreenPosition();
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [syncTextEditorScreenPosition, textEditor]);

  const updateMapEditElementsWithoutHistory = useCallback(
    (updater: (current: MapEditElement[]) => MapEditElement[]) => {
      setMapEditElements((previous) => updater(previous));
    },
    []
  );

  const updateSelectedMapEditElement = useCallback(
    (updater: (element: MapEditElement) => MapEditElement) => {
      if (!selectedMapEditElementId) {
        return;
      }

      const currentElement = mapEditElementsRef.current.find(
        (element) => element.id === selectedMapEditElementId
      );
      if (!currentElement) {
        return;
      }

      const updatedElement = updater(currentElement);
      commitMapEditOperations([
        {
          kind: 'UPSERT',
          elements: [updatedElement]
        }
      ]);
    },
    [commitMapEditOperations, selectedMapEditElementId]
  );

  const undoMapEdit = useCallback(() => {
    if (!callbacksRef.current.optimisticMapEdit) {
      return;
    }

    let operationsToSync: MapEditOperation[] = [];

    setMapEditElements((current) => {
      const previousSnapshot = mapEditUndoStackRef.current.pop();

      if (!previousSnapshot) {
        return current;
      }

      mapEditRedoStackRef.current.push(cloneMapEditElements(current));
      const next = cloneMapEditElements(previousSnapshot);
      operationsToSync = buildMapEditOperationsDiff(current, next);
      return next;
    });

    if (operationsToSync.length > 0) {
      callbacksRef.current.onMapEditOperations(operationsToSync, {
        immediate: true
      });
    }
  }, []);

  const redoMapEdit = useCallback(() => {
    if (!callbacksRef.current.optimisticMapEdit) {
      return;
    }

    let operationsToSync: MapEditOperation[] = [];

    setMapEditElements((current) => {
      const nextSnapshot = mapEditRedoStackRef.current.pop();

      if (!nextSnapshot) {
        return current;
      }

      mapEditUndoStackRef.current.push(cloneMapEditElements(current));
      const next = cloneMapEditElements(nextSnapshot);
      operationsToSync = buildMapEditOperationsDiff(current, next);
      return next;
    });

    if (operationsToSync.length > 0) {
      callbacksRef.current.onMapEditOperations(operationsToSync, {
        immediate: true
      });
    }
  }, []);

  const resolvePolylineSnapPoint = useCallback(
    (rawPoint: MapEditPoint, polylinePoints: MapEditPoint[]): MapEditPoint => {
      const worldScale = Math.max(0.0001, Math.abs(worldRef.current?.scale.x ?? 1));
      const maxNodeSnapDistance = 14 / worldScale;
      const anchor = polylinePoints[polylinePoints.length - 1];

      let candidate = cloneMapEditPoint(rawPoint);
      if (anchor) {
        const orthogonal = maybeSnapToOrthogonal(anchor, rawPoint, 12);
        if (orthogonal) {
          candidate = orthogonal;
        }
      }

      const existingNodes = collectMapEditSnapNodes(mapEditElementsRef.current);
      const nearNode = findNearestSnapNode(
        candidate,
        [...polylinePoints.map((point) => cloneMapEditPoint(point)), ...existingNodes],
        maxNodeSnapDistance
      );

      return nearNode ?? candidate;
    },
    []
  );

  const clearMapEditPreview = useCallback(() => {
    mapEditPreviewRef.current?.clear();
  }, []);

  const finishPolylineGesture = useCallback(
    (commit: boolean): boolean => {
      const gesture = mapEditGestureRef.current;
      if (!gesture || gesture.kind !== 'POLYLINE') {
        return false;
      }

      mapEditGestureRef.current = null;
      clearMapEditPreview();

      if (!commit || gesture.points.length < 2) {
        return true;
      }

      const created: MapEditLineElement[] = [];
      for (let index = 1; index < gesture.points.length; index += 1) {
        const start = gesture.points[index - 1];
        const end = gesture.points[index];
        if (!start || !end) {
          continue;
        }

        const line = buildLineElement({
          start,
          end,
          color: mapEditorStrokeColorRef.current,
          strokeWidth: mapEditorStrokeWidthRef.current
        });
        if (line) {
          created.push(line);
        }
      }

      if (created.length > 0) {
        commitMapEditOperations(
          [
            {
              kind: 'UPSERT',
              elements: created
            }
          ],
          {
            immediate: true
          }
        );
        const last = created[created.length - 1];
        if (last) {
          setSelectedMapEditElementId(last.id);
        }
      }

      return true;
    },
    [clearMapEditPreview, commitMapEditOperations]
  );

  const drawBrushCursor = useCallback((worldPoint: MapEditPoint) => {
    const brushCursor = mapEditBrushCursorRef.current;
    if (!brushCursor) {
      return;
    }

    const usesBrush = mapEditorToolRef.current === 'DRAW' || mapEditorToolRef.current === 'ERASE';
    if (!boardSettingsRef.current.mapEditMode || !callbacksRef.current.canEditMap || !usesBrush) {
      brushCursor.clear();
      return;
    }

    const radius = clamp(mapEditorStrokeWidthRef.current, 1, 64) / 2;
    const color =
      mapEditorToolRef.current === 'ERASE'
        ? 0xf97316
        : parseHexColor(mapEditorStrokeColorRef.current, 0x38bdf8);

    brushCursor.clear();
    brushCursor.circle(worldPoint.x, worldPoint.y, Math.max(0.5, radius));
    brushCursor.stroke({
      color,
      width: 1.4,
      alpha: 0.95
    });
    brushCursor.fill({
      color,
      alpha: mapEditorToolRef.current === 'ERASE' ? 0.35 : 0.45
    });
  }, []);

  const drawMapEditPreview = useCallback((gesture: Exclude<MapEditGesture, null>) => {
    const preview = mapEditPreviewRef.current;

    if (!preview) {
      return;
    }

    preview.clear();

    if (gesture.kind === 'DRAW') {
      if (gesture.points.length < 1) {
        return;
      }

      const radius = clamp(mapEditorStrokeWidthRef.current, 1, 64) / 2;
      for (const point of gesture.points) {
        preview.circle(point.x, point.y, radius);
      }

      preview.fill({
        color: parseHexColor(mapEditorStrokeColorRef.current, 0x38bdf8),
        alpha: clamp(0.95 * mapEditBrushAlphaFactor[gesture.brush], 0.25, 1)
      });
      return;
    }

    if (gesture.kind === 'ERASE') {
      if (gesture.points.length < 1) {
        return;
      }

      const radius = clamp(mapEditorStrokeWidthRef.current, 1, 64) / 2;
      for (const point of gesture.points) {
        preview.circle(point.x, point.y, radius);
      }
      preview.fill({
        color: 0xf97316,
        alpha: 0.35
      });
      return;
    }

    if (gesture.kind === 'POLYLINE') {
      if (gesture.points.length === 0) {
        return;
      }

      const strokeColor = parseHexColor(mapEditorStrokeColorRef.current, 0x38bdf8);
      const previewPoints = [...gesture.points];
      const lastPoint = gesture.points[gesture.points.length - 1];
      if (
        gesture.current &&
        lastPoint &&
        (Math.abs(gesture.current.x - lastPoint.x) > 0.001 ||
          Math.abs(gesture.current.y - lastPoint.y) > 0.001)
      ) {
        previewPoints.push(gesture.current);
      }

      if (previewPoints.length >= 2) {
        const first = previewPoints[0];
        if (first) {
          preview.moveTo(first.x, first.y);
          for (let index = 1; index < previewPoints.length; index += 1) {
            const point = previewPoints[index];
            if (!point) {
              continue;
            }

            preview.lineTo(point.x, point.y);
          }
        }

        preview.stroke({
          color: strokeColor,
          width: clamp(mapEditorStrokeWidthRef.current, 1, 64),
          alpha: 0.9
        });
      }

      const nodeRadius = clamp(mapEditorStrokeWidthRef.current * 0.25, 3, 8);
      for (const point of gesture.points) {
        preview.circle(point.x, point.y, nodeRadius);
      }
      preview.fill({
        color: strokeColor,
        alpha: 0.9
      });
      return;
    }

    if (gesture.kind !== 'SHAPE') {
      return;
    }

    const centerX = (gesture.start.x + gesture.current.x) / 2;
    const centerY = (gesture.start.y + gesture.current.y) / 2;
    const width = Math.abs(gesture.current.x - gesture.start.x);
    const height = Math.abs(gesture.current.y - gesture.start.y);

    if (width < 1 || height < 1) {
      return;
    }

    if (gesture.tool === 'RECT') {
      preview.rect(centerX - width / 2, centerY - height / 2, width, height);
    } else {
      preview.ellipse(centerX, centerY, width / 2, height / 2);
    }

    preview.fill({
      color: parseHexColor(mapEditorFillColorRef.current, 0x38bdf8),
      alpha: 0.2
    });
    preview.stroke({
      color: parseHexColor(mapEditorStrokeColorRef.current, 0x38bdf8),
      width: clamp(mapEditorStrokeWidthRef.current, 1, 64),
      alpha: 0.95
    });
  }, []);

  useEffect(() => {
    const mountNode = mountRef.current;

    if (!mountNode) {
      return;
    }

    const app = new Application();
    appRef.current = app;

    const world = new Container();
    const mapLayer = new Container();
    const mapEditLayer = new Container();
    mapEditLayer.sortableChildren = true;
    const mapEditPreview = new Graphics();
    const mapEditBrushCursor = new Graphics();
    const interactionLayer = new Graphics();
    const gridGraphics = new Graphics();
    const hoverGraphics = new Graphics();
    const tokenLayer = new Container();
    tokenLayer.sortableChildren = true;

    worldRef.current = world;
    mapLayerRef.current = mapLayer;
    mapEditLayerRef.current = mapEditLayer;
    mapEditPreviewRef.current = mapEditPreview;
    mapEditBrushCursorRef.current = mapEditBrushCursor;
    interactionLayerRef.current = interactionLayer;
    gridRef.current = gridGraphics;
    hoverRef.current = hoverGraphics;
    tokenLayerRef.current = tokenLayer;

    let disposed = false;
    let initialized = false;

    const refreshBoardVisuals = () => {
      const appInstance = appRef.current;
      const grid = gridRef.current;
      const interaction = interactionLayerRef.current;
      const renderer = (appInstance as { renderer?: { width: number; height: number } } | null)
        ?.renderer;

      if (!appInstance || !grid || !interaction || !renderer) {
        return;
      }

      const mapScale = Math.max(0.1, boardSettingsRef.current.mapScale);
      const boardWidth = Math.max(
        DEFAULT_BOARD_SIZE,
        renderer.width * 2,
        (mapSizeRef.current?.width ?? 0) * mapScale +
          Math.abs(boardSettingsRef.current.mapOffsetX) * 2 +
          600
      );
      const boardHeight = Math.max(
        DEFAULT_BOARD_SIZE,
        renderer.height * 2,
        (mapSizeRef.current?.height ?? 0) * mapScale +
          Math.abs(boardSettingsRef.current.mapOffsetY) * 2 +
          600
      );

      appInstance.stage.hitArea = new Rectangle(0, 0, renderer.width, renderer.height);
      drawInteractionLayer(interaction, boardWidth, boardHeight);
      drawGrid(grid, boardWidth, boardHeight, boardSettingsRef.current);
    };

    const applyMapTransform = () => {
      const mapSprite = mapSpriteRef.current;

      if (!mapSprite) {
        return;
      }

      mapSprite.x = boardSettingsRef.current.mapOffsetX;
      mapSprite.y = boardSettingsRef.current.mapOffsetY;
      mapSprite.scale.set(boardSettingsRef.current.mapScale);
      mapSprite.rotation = degToRad(boardSettingsRef.current.mapRotationDeg);
    };

    refreshBoardVisualsRef.current = refreshBoardVisuals;
    applyMapTransformRef.current = applyMapTransform;

    const clearHoveredCell = () => {
      hoveredCellRef.current = null;
      const hoverGraphicsInstance = hoverRef.current;

      if (hoverGraphicsInstance) {
        drawHoverCell(hoverGraphicsInstance, null, boardSettingsRef.current);
      }
    };

    const toWorldPoint = (event: FederatedPointerEvent): { x: number; y: number } => {
      const worldContainer = worldRef.current;

      if (!worldContainer) {
        return {
          x: 0,
          y: 0
        };
      }

      const localPoint = worldContainer.toLocal(event.global);
      return {
        x: localPoint.x,
        y: localPoint.y
      };
    };

    const updateHoveredCell = (worldX: number, worldY: number) => {
      const hoverGraphicsInstance = hoverRef.current;

      if (!hoverGraphicsInstance) {
        return;
      }

      const snapped = snapToGrid(worldX, worldY, boardSettingsRef.current);
      const previousCell = hoveredCellRef.current;

      if (previousCell?.centerX === snapped.centerX && previousCell.centerY === snapped.centerY) {
        return;
      }

      hoveredCellRef.current = {
        centerX: snapped.centerX,
        centerY: snapped.centerY
      };
      drawHoverCell(
        hoverGraphicsInstance,
        {
          centerX: snapped.centerX,
          centerY: snapped.centerY
        },
        boardSettingsRef.current
      );
    };

    const openContextMenu = (
      event: FederatedPointerEvent,
      options?: {
        tokenId?: string;
        worldX?: number;
        worldY?: number;
      }
    ) => {
      if (boardSettingsRef.current.mapEditMode) {
        return;
      }

      const appInstance = appRef.current;
      const nativeMouseEvent = event.nativeEvent as MouseEvent | undefined;

      if (!appInstance) {
        return;
      }

      const clientX = nativeMouseEvent?.clientX ?? event.global.x;
      const clientY = nativeMouseEvent?.clientY ?? event.global.y;
      nativeMouseEvent?.preventDefault();
      event.stopPropagation();

      const worldPoint =
        options?.worldX !== undefined && options?.worldY !== undefined
          ? {
              x: options.worldX,
              y: options.worldY
            }
          : toWorldPoint(event);
      const snapped = snapToGrid(worldPoint.x, worldPoint.y, boardSettingsRef.current);
      const canvasRect = appInstance.canvas.getBoundingClientRect();

      setContextMenu({
        x: clientX - canvasRect.left,
        y: clientY - canvasRect.top,
        worldX: snapped.centerX,
        worldY: snapped.centerY,
        tokenId: options?.tokenId ?? null
      });
      setTokenModal(null);
      setTokenFormError(null);
    };

    const handlePointerMove = (event: FederatedPointerEvent) => {
      const worldContainer = worldRef.current;
      const panState = panStateRef.current;

      if (!worldContainer) {
        return;
      }

      const worldPoint = toWorldPoint(event);
      updateHoveredCell(worldPoint.x, worldPoint.y);
      drawBrushCursor(worldPoint);

      const mapElementDragState = mapElementDragRef.current;
      if (mapElementDragState && mapElementDragState.pointerId === event.pointerId) {
        const deltaX = worldPoint.x - mapElementDragState.startPointer.x;
        const deltaY = worldPoint.y - mapElementDragState.startPointer.y;
        if (Math.abs(deltaX) > 0.2 || Math.abs(deltaY) > 0.2) {
          mapElementDragState.moved = true;
        }

        if (callbacksRef.current.optimisticMapEdit) {
          updateMapEditElementsWithoutHistory((current) =>
            current.map((element) =>
              element.id === mapElementDragState.elementId
                ? {
                    ...element,
                    x: mapElementDragState.startElementX + deltaX,
                    y: mapElementDragState.startElementY + deltaY
                  }
                : element
            )
          );
        }
        return;
      }

      const mapEditGesture = mapEditGestureRef.current;
      if (mapEditGesture?.kind === 'POLYLINE') {
        mapEditGesture.current = resolvePolylineSnapPoint(
          {
            x: worldPoint.x,
            y: worldPoint.y
          },
          mapEditGesture.points
        );
        drawMapEditPreview(mapEditGesture);
        return;
      }

      if (mapEditGesture && mapEditGesture.pointerId === event.pointerId) {
        if (mapEditGesture.kind === 'DRAW') {
          const didAppend = appendBrushPoints(
            mapEditGesture.points,
            {
              x: worldPoint.x,
              y: worldPoint.y
            },
            Math.max(0.8, mapEditorStrokeWidthRef.current * 0.35)
          );
          if (didAppend) {
            drawMapEditPreview(mapEditGesture);
          }
        } else if (mapEditGesture.kind === 'SHAPE') {
          mapEditGesture.current = {
            x: worldPoint.x,
            y: worldPoint.y
          };
          drawMapEditPreview(mapEditGesture);
        } else {
          const didAppend = appendBrushPoints(
            mapEditGesture.points,
            {
              x: worldPoint.x,
              y: worldPoint.y
            },
            Math.max(0.8, mapEditorStrokeWidthRef.current * 0.35)
          );
          if (didAppend) {
            drawMapEditPreview(mapEditGesture);
          }
        }
        return;
      }

      if (panState.active && panState.pointerId === event.pointerId) {
        const deltaX = event.global.x - panState.lastGlobalX;
        const deltaY = event.global.y - panState.lastGlobalY;

        if (panState.mode === 'MAP') {
          const worldScale = Math.max(0.0001, worldContainer.scale.x);
          callbacksRef.current.onBoardSettingsChange({
            mapOffsetX: boardSettingsRef.current.mapOffsetX + deltaX / worldScale,
            mapOffsetY: boardSettingsRef.current.mapOffsetY + deltaY / worldScale
          });
        } else {
          worldContainer.x += deltaX;
          worldContainer.y += deltaY;
        }

        panState.lastGlobalX = event.global.x;
        panState.lastGlobalY = event.global.y;
        return;
      }

      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      callbacksRef.current.onMoveToken(
        dragState.tokenId,
        worldPoint.x - dragState.offsetX,
        worldPoint.y - dragState.offsetY,
        {
          final: false
        }
      );
    };

    const handlePointerUp = (event: FederatedPointerEvent) => {
      const mapElementDragState = mapElementDragRef.current;
      if (mapElementDragState && mapElementDragState.pointerId === event.pointerId) {
        if (mapElementDragState.moved) {
          if (callbacksRef.current.optimisticMapEdit) {
            pushMapEditUndoSnapshot(mapElementDragState.snapshotBefore);
            mapEditRedoStackRef.current = [];
            const updatedElement = mapEditElementsRef.current.find(
              (element) => element.id === mapElementDragState.elementId
            );
            if (updatedElement) {
              callbacksRef.current.onMapEditOperations(
                [
                  {
                    kind: 'UPSERT',
                    elements: [updatedElement]
                  }
                ],
                {
                  immediate: true
                }
              );
            }
          } else {
            const originalElement = mapElementDragState.snapshotBefore.find(
              (element) => element.id === mapElementDragState.elementId
            );
            if (originalElement) {
              const releasedPoint = toWorldPoint(event);
              const deltaX = releasedPoint.x - mapElementDragState.startPointer.x;
              const deltaY = releasedPoint.y - mapElementDragState.startPointer.y;
              const updatedElement: MapEditElement = {
                ...originalElement,
                x: mapElementDragState.startElementX + deltaX,
                y: mapElementDragState.startElementY + deltaY
              };

              callbacksRef.current.onMapEditOperations(
                [
                  {
                    kind: 'UPSERT',
                    elements: [updatedElement]
                  }
                ],
                {
                  immediate: true
                }
              );
            }
          }
        }

        mapElementDragRef.current = null;
        if (appRef.current) {
          appRef.current.canvas.style.cursor = resolveCanvasCursor({
            boardSettings: boardSettingsRef.current,
            canEditMap: callbacksRef.current.canEditMap,
            mapEditorTool: mapEditorToolRef.current
          });
        }
        return;
      }

      const mapEditGesture = mapEditGestureRef.current;
      if (mapEditGesture?.kind === 'POLYLINE') {
        return;
      }

      if (mapEditGesture && mapEditGesture.pointerId === event.pointerId) {
        if (mapEditGesture.kind === 'DRAW') {
          const firstPoint = mapEditGesture.points[0];
          if (!firstPoint) {
            mapEditGestureRef.current = null;
            clearMapEditPreview();
            return;
          }

          const normalizedPoints =
            mapEditGesture.points.length === 1 ? [firstPoint, firstPoint] : mapEditGesture.points;
          const created = buildPathElement({
            points: normalizedPoints,
            color: mapEditorStrokeColorRef.current,
            strokeWidth: mapEditorStrokeWidthRef.current,
            brush: mapEditGesture.brush
          });

          if (created) {
            commitMapEditOperations(
              [
                {
                  kind: 'UPSERT',
                  elements: [created]
                }
              ],
              {
                immediate: true
              }
            );
            setSelectedMapEditElementId(created.id);
          }
        } else if (mapEditGesture.kind === 'SHAPE' && mapEditGesture.tool === 'RECT') {
          const created = buildRectElement({
            start: mapEditGesture.start,
            end: mapEditGesture.current,
            strokeColor: mapEditorStrokeColorRef.current,
            fillColor: mapEditorFillColorRef.current,
            strokeWidth: mapEditorStrokeWidthRef.current
          });

          if (created) {
            commitMapEditOperations(
              [
                {
                  kind: 'UPSERT',
                  elements: [created]
                }
              ],
              {
                immediate: true
              }
            );
            setSelectedMapEditElementId(created.id);
          }
        } else if (mapEditGesture.kind === 'SHAPE') {
          const created = buildEllipseElement({
            start: mapEditGesture.start,
            end: mapEditGesture.current,
            strokeColor: mapEditorStrokeColorRef.current,
            fillColor: mapEditorFillColorRef.current,
            strokeWidth: mapEditorStrokeWidthRef.current
          });

          if (created) {
            commitMapEditOperations(
              [
                {
                  kind: 'UPSERT',
                  elements: [created]
                }
              ],
              {
                immediate: true
              }
            );
            setSelectedMapEditElementId(created.id);
          }
        } else {
          const firstPoint = mapEditGesture.points[0];
          if (!firstPoint) {
            mapEditGestureRef.current = null;
            clearMapEditPreview();
            return;
          }

          const normalizedPoints =
            mapEditGesture.points.length === 1 ? [firstPoint, firstPoint] : mapEditGesture.points;
          applyEraseGestureToElements(normalizedPoints);
          setSelectedMapEditElementId(null);
        }

        mapEditGestureRef.current = null;
        clearMapEditPreview();
        return;
      }

      const panState = panStateRef.current;

      if (panState.active && panState.pointerId === event.pointerId) {
        panState.active = false;
        panState.pointerId = null;

        if (appRef.current) {
          appRef.current.canvas.style.cursor = resolveCanvasCursor({
            boardSettings: boardSettingsRef.current,
            canEditMap: callbacksRef.current.canEditMap,
            mapEditorTool: mapEditorToolRef.current
          });
        }

        return;
      }

      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      const point = toWorldPoint(event);
      callbacksRef.current.onMoveToken(
        dragState.tokenId,
        point.x - dragState.offsetX,
        point.y - dragState.offsetY,
        {
          final: true
        }
      );
      dragStateRef.current = null;
    };

    const handleWheel = (event: WheelEvent) => {
      const appInstance = appRef.current;
      const worldContainer = worldRef.current;

      if (!appInstance || !worldContainer) {
        return;
      }

      event.preventDefault();

      const canvasRect = appInstance.canvas.getBoundingClientRect();
      const pointerX = event.clientX - canvasRect.left;
      const pointerY = event.clientY - canvasRect.top;

      const oldScale = worldContainer.scale.x;

      if (
        event.ctrlKey &&
        boardSettingsRef.current.mapEditMode &&
        callbacksRef.current.canEditMap &&
        (mapEditorToolRef.current === 'DRAW' ||
          mapEditorToolRef.current === 'ERASE' ||
          mapEditorToolRef.current === 'LINE' ||
          mapEditorToolRef.current === 'RECT' ||
          mapEditorToolRef.current === 'ELLIPSE')
      ) {
        const delta = event.deltaY < 0 ? 1 : -1;
        setMapEditorStrokeWidth((previous) => clamp(previous + delta, 1, 64));
        drawBrushCursor({
          x: (pointerX - worldContainer.x) / oldScale,
          y: (pointerY - worldContainer.y) / oldScale
        });
        return;
      }

      const zoomMultiplier = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextScale = clamp(oldScale * zoomMultiplier, MIN_ZOOM, MAX_ZOOM);

      if (nextScale === oldScale) {
        return;
      }

      const localX = (pointerX - worldContainer.x) / oldScale;
      const localY = (pointerY - worldContainer.y) / oldScale;

      worldContainer.scale.set(nextScale);
      worldContainer.x = pointerX - localX * nextScale;
      worldContainer.y = pointerY - localY * nextScale;
    };

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleStagePointerDown = (event: FederatedPointerEvent) => {
      const nativeMouseEvent = event.nativeEvent as MouseEvent | undefined;
      const button = nativeMouseEvent?.button ?? -1;

      if (button === 2) {
        if (boardSettingsRef.current.mapEditMode) {
          setContextMenu(null);
          return;
        }

        openContextMenu(event);
        return;
      }

      if (button !== 0 && button !== 1) {
        return;
      }

      if (button === 0 && boardSettingsRef.current.mapCalibrationMode) {
        nativeMouseEvent?.preventDefault();
        event.stopPropagation();
        setContextMenu(null);
        setTokenModal(null);
        setTokenFormError(null);
        if (mapEditorToolRef.current !== 'TEXT') {
          setTextEditor(null);
        }
        const worldPoint = toWorldPoint(event);
        callbacksRef.current.onMapCalibrationPoint?.({
          x: worldPoint.x,
          y: worldPoint.y
        });
        return;
      }

      const startPan = (mode: 'BOARD' | 'MAP') => {
        panStateRef.current.active = true;
        panStateRef.current.pointerId = event.pointerId;
        panStateRef.current.lastGlobalX = event.global.x;
        panStateRef.current.lastGlobalY = event.global.y;
        panStateRef.current.mode = mode;

        if (appRef.current) {
          appRef.current.canvas.style.cursor = 'grabbing';
        }
      };

      if (button === 0 && boardSettingsRef.current.mapEditMode) {
        nativeMouseEvent?.preventDefault();
        event.stopPropagation();
        setContextMenu(null);
        setTokenModal(null);
        setTokenFormError(null);

        if (!callbacksRef.current.canEditMap) {
          return;
        }

        if (mapEditorToolRef.current === 'PAN') {
          startPan('BOARD');
          return;
        }

        if (mapEditorToolRef.current === 'PAN_MAP') {
          startPan('MAP');
          return;
        }

        const worldPoint = toWorldPoint(event);

        if (mapEditorToolRef.current === 'SELECT') {
          setSelectedMapEditElementId(null);
          return;
        }

        if (mapEditorToolRef.current === 'DRAW') {
          mapEditGestureRef.current = {
            kind: 'DRAW',
            pointerId: event.pointerId,
            points: [{ x: worldPoint.x, y: worldPoint.y }],
            brush: mapEditorBrushRef.current
          };
          drawBrushCursor(worldPoint);
          drawMapEditPreview(mapEditGestureRef.current);
          return;
        }

        if (mapEditorToolRef.current === 'LINE') {
          const existingPolyline =
            mapEditGestureRef.current?.kind === 'POLYLINE' ? mapEditGestureRef.current : null;
          const snappedPoint = resolvePolylineSnapPoint(
            {
              x: worldPoint.x,
              y: worldPoint.y
            },
            existingPolyline?.points ?? []
          );

          if (!existingPolyline) {
            mapEditGestureRef.current = {
              kind: 'POLYLINE',
              points: [snappedPoint],
              current: snappedPoint
            };
            drawMapEditPreview(mapEditGestureRef.current);
            setSelectedMapEditElementId(null);
            return;
          }

          const lastPoint = existingPolyline.points[existingPolyline.points.length - 1];
          if (
            !lastPoint ||
            Math.hypot(lastPoint.x - snappedPoint.x, lastPoint.y - snappedPoint.y) > 0.25
          ) {
            existingPolyline.points.push(snappedPoint);
          }
          existingPolyline.current = snappedPoint;
          drawMapEditPreview(existingPolyline);
          setSelectedMapEditElementId(null);
          return;
        }

        if (mapEditorToolRef.current === 'RECT' || mapEditorToolRef.current === 'ELLIPSE') {
          mapEditGestureRef.current = {
            kind: 'SHAPE',
            pointerId: event.pointerId,
            tool: mapEditorToolRef.current,
            start: {
              x: worldPoint.x,
              y: worldPoint.y
            },
            current: {
              x: worldPoint.x,
              y: worldPoint.y
            }
          };
          drawMapEditPreview(mapEditGestureRef.current);
          return;
        }

        if (mapEditorToolRef.current === 'TEXT') {
          openTextEditorForCreate({
            worldX: worldPoint.x,
            worldY: worldPoint.y,
            screenX: event.global.x,
            screenY: event.global.y
          });
          return;
        }

        if (mapEditorToolRef.current === 'IMAGE') {
          if (!pendingMapImageRef.current) {
            return;
          }

          const created: MapEditImageElement = {
            id: createMapEditId(),
            type: 'IMAGE',
            x: worldPoint.x,
            y: worldPoint.y,
            rotationDeg: 0,
            scale: 1,
            opacity: 1,
            imageRef: pendingMapImageRef.current.imageRef,
            sourceUrl: pendingMapImageRef.current.sourceUrl,
            label: pendingMapImageRef.current.label,
            width: pendingMapImageRef.current.width,
            height: pendingMapImageRef.current.height
          };

          commitMapEditOperations(
            [
              {
                kind: 'UPSERT',
                elements: [created]
              }
            ],
            {
              immediate: true
            }
          );
          setSelectedMapEditElementId(created.id);
          return;
        }

        if (mapEditorToolRef.current === 'OBJECT') {
          const selectedObject =
            mapObjectLibraryRef.current.find(
              (entry) => entry.id === selectedMapObjectIdRef.current
            ) ?? mapObjectLibraryRef.current[0];
          if (!selectedObject) {
            return;
          }

          const created: MapEditImageElement = {
            id: createMapEditId(),
            type: 'IMAGE',
            x: worldPoint.x,
            y: worldPoint.y,
            rotationDeg: 0,
            scale: 1,
            opacity: 1,
            imageRef: selectedObject.imageRef,
            sourceUrl: selectedObject.sourceUrl,
            label: selectedObject.label,
            width: selectedObject.width,
            height: selectedObject.height
          };

          commitMapEditOperations(
            [
              {
                kind: 'UPSERT',
                elements: [created]
              }
            ],
            {
              immediate: true
            }
          );
          setSelectedMapEditElementId(created.id);
          return;
        }

        if (mapEditorToolRef.current === 'ERASE') {
          mapEditGestureRef.current = {
            kind: 'ERASE',
            pointerId: event.pointerId,
            points: [{ x: worldPoint.x, y: worldPoint.y }]
          };
          drawBrushCursor(worldPoint);
          drawMapEditPreview(mapEditGestureRef.current);
          setSelectedMapEditElementId(null);
          return;
        }
      }

      nativeMouseEvent?.preventDefault();
      event.stopPropagation();
      setContextMenu(null);
      setTokenModal(null);
      setTokenFormError(null);

      const shouldPanMapOnly =
        boardSettingsRef.current.mapEditMode && mapEditorToolRef.current === 'PAN_MAP';
      startPan(shouldPanMapOnly ? 'MAP' : 'BOARD');
    };

    const handleCanvasMouseLeave = () => {
      clearHoveredCell();
      mapEditBrushCursorRef.current?.clear();
    };

    const handleResize = () => {
      refreshBoardVisuals();
    };

    const init = async () => {
      try {
        await app.init({
          resizeTo: mountNode,
          background: '#0b1220',
          antialias: true
        });

        if (disposed) {
          app.destroy();
          return;
        }

        mountNode.appendChild(app.canvas);

        app.stage.eventMode = 'static';
        world.eventMode = 'passive';

        world.x = 24;
        world.y = 24;

        mapLayer.eventMode = 'none';
        mapEditLayer.eventMode = 'passive';
        mapEditPreview.eventMode = 'none';
        mapEditBrushCursor.eventMode = 'none';
        interactionLayer.eventMode = 'none';
        gridGraphics.eventMode = 'none';
        hoverGraphics.eventMode = 'none';
        tokenLayer.eventMode = 'passive';
        app.canvas.style.cursor = resolveCanvasCursor({
          boardSettings: boardSettingsRef.current,
          canEditMap: callbacksRef.current.canEditMap,
          mapEditorTool: mapEditorToolRef.current
        });

        world.addChild(mapLayer);
        world.addChild(mapEditLayer);
        world.addChild(mapEditPreview);
        world.addChild(mapEditBrushCursor);
        world.addChild(interactionLayer);
        world.addChild(gridGraphics);
        world.addChild(hoverGraphics);
        world.addChild(tokenLayer);

        app.stage.addChild(world);

        app.stage.on('globalpointermove', handlePointerMove);
        app.stage.on('pointerdown', handleStagePointerDown);
        app.stage.on('pointerup', handlePointerUp);
        app.stage.on('pointerupoutside', handlePointerUp);

        app.renderer.on('resize', handleResize);
        app.canvas.addEventListener('wheel', handleWheel, {
          passive: false
        });
        app.canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
        app.canvas.addEventListener('contextmenu', preventContextMenu);

        isAppInitializedRef.current = true;
        refreshBoardVisuals();
        initialized = true;
      } catch (error) {
        isAppInitializedRef.current = false;
        console.error('Pixi board initialization failed', error);
      }
    };

    void init();

    return () => {
      disposed = true;
      dragStateRef.current = null;
      panStateRef.current.active = false;
      panStateRef.current.pointerId = null;
      mapSizeRef.current = null;
      refreshBoardVisualsRef.current = null;
      applyMapTransformRef.current = null;
      isAppInitializedRef.current = false;
      clearHoveredCell();

      for (const texture of tokenTextureCacheRef.current.values()) {
        texture.destroy(true);
      }

      tokenTextureCacheRef.current.clear();
      mapEditTextureLoadingRef.current.clear();

      for (const texture of mapEditTextureCacheRef.current.values()) {
        texture.destroy(true);
      }

      mapEditTextureCacheRef.current.clear();

      for (const sourceUrl of mapEditObjectUrlsRef.current.values()) {
        URL.revokeObjectURL(sourceUrl);
      }

      mapEditObjectUrlsRef.current.clear();

      if (!initialized) {
        return;
      }

      app.stage.off('globalpointermove', handlePointerMove);
      app.stage.off('pointerdown', handleStagePointerDown);
      app.stage.off('pointerup', handlePointerUp);
      app.stage.off('pointerupoutside', handlePointerUp);
      app.renderer.off('resize', handleResize);
      app.canvas.removeEventListener('wheel', handleWheel);
      app.canvas.removeEventListener('mouseleave', handleCanvasMouseLeave);
      app.canvas.removeEventListener('contextmenu', preventContextMenu);

      app.destroy(true, {
        children: true,
        texture: true
      });

      appRef.current = null;
      worldRef.current = null;
      mapLayerRef.current = null;
      mapEditLayerRef.current = null;
      mapEditPreviewRef.current = null;
      mapEditBrushCursorRef.current = null;
      mapSpriteRef.current = null;
      interactionLayerRef.current = null;
      gridRef.current = null;
      hoverRef.current = null;
      tokenLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isAppInitializedRef.current) {
      return;
    }

    refreshBoardVisualsRef.current?.();

    const hovered = hoveredCellRef.current;
    if (hovered && hoverRef.current) {
      drawHoverCell(hoverRef.current, hovered, boardSettings);
    }
  }, [
    boardSettings.gridType,
    boardSettings.cellSizePx,
    boardSettings.gridOriginX,
    boardSettings.gridOriginY
  ]);

  useEffect(() => {
    applyMapTransformRef.current?.();
    refreshBoardVisualsRef.current?.();
  }, [
    boardSettings.mapOffsetX,
    boardSettings.mapOffsetY,
    boardSettings.mapScale,
    boardSettings.mapRotationDeg
  ]);

  useEffect(() => {
    if (!isAppInitializedRef.current || !appRef.current) {
      return;
    }

    appRef.current.canvas.style.cursor = resolveCanvasCursor({
      boardSettings,
      canEditMap,
      mapEditorTool
    });
  }, [boardSettings, canEditMap, mapEditorTool]);

  useEffect(() => {
    if (mapEditorTool === 'DRAW' || mapEditorTool === 'ERASE') {
      return;
    }

    mapEditBrushCursorRef.current?.clear();
  }, [mapEditorTool]);

  useEffect(() => {
    if (!isAppInitializedRef.current) {
      return;
    }

    const mapLayer = mapLayerRef.current;

    if (!mapLayer) {
      return;
    }

    let cancelled = false;

    const clearMapSprite = () => {
      const existingMapSprite = mapSpriteRef.current;

      if (!existingMapSprite) {
        return;
      }

      mapLayer.removeChild(existingMapSprite);
      const texture = existingMapSprite.texture;
      existingMapSprite.destroy();
      texture.destroy(true);
      mapSpriteRef.current = null;
    };

    clearMapSprite();

    if (!mapImageUrl) {
      mapSizeRef.current = null;
      refreshBoardVisualsRef.current?.();
      return;
    }

    void loadTextureFromUrl(mapImageUrl)
      .then((texture) => {
        if (cancelled) {
          texture.destroy(true);
          return;
        }

        const sprite = new Sprite(texture);
        sprite.x = 0;
        sprite.y = 0;

        mapLayer.addChild(sprite);
        mapSpriteRef.current = sprite;
        mapSizeRef.current = {
          width: Math.max(1, texture.width),
          height: Math.max(1, texture.height)
        };

        applyMapTransformRef.current?.();
        refreshBoardVisualsRef.current?.();
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        mapSizeRef.current = null;
        refreshBoardVisualsRef.current?.();
        console.error('Map image could not be loaded', error);
      });

    return () => {
      cancelled = true;
      clearMapSprite();
    };
  }, [mapImageUrl]);

  useEffect(() => {
    const mapEditLayer = mapEditLayerRef.current;

    if (!mapEditLayer) {
      return;
    }

    let cancelled = false;

    const renderMapEdits = () => {
      if (cancelled) {
        return;
      }

      mapEditLayer.removeChildren();

      for (const [index, element] of mapEditElements.entries()) {
        const container = new Container();
        container.x = element.x;
        container.y = element.y;
        container.rotation = degToRad(element.rotationDeg);
        container.scale.set(element.scale);
        container.zIndex = index;

        const isErasePath = element.type === 'ERASE_PATH';
        if (!isErasePath) {
          const bounds = getMapEditElementLocalBounds(element);
          container.hitArea = new Rectangle(
            bounds.minX,
            bounds.minY,
            Math.max(1, bounds.width),
            Math.max(1, bounds.height)
          );
          container.eventMode = 'static';
        } else {
          container.eventMode = 'none';
        }

        if (boardSettings.mapEditMode && canEditMap) {
          if (isErasePath) {
            container.cursor = 'default';
          } else if (mapEditorTool === 'SELECT') {
            container.cursor = 'move';
          } else if (mapEditorTool === 'DRAW') {
            container.cursor = 'none';
          } else if (mapEditorTool === 'ERASE') {
            container.cursor = 'none';
          } else if (mapEditorTool === 'TEXT' && element.type === 'TEXT') {
            container.cursor = 'text';
          } else {
            container.cursor = 'default';
          }
        } else {
          container.cursor = 'default';
        }

        const content = new Container();

        if (element.type === 'IMAGE') {
          let builtinSourceUrl: string | null = null;
          let cloudAssetId: string | null = null;

          if (element.imageRef.kind === 'CLOUD_ASSET') {
            cloudAssetId = element.imageRef.assetId;

            if (cloudAssetId.startsWith('builtin:')) {
              builtinSourceUrl =
                DEFAULT_MAP_OBJECT_LIBRARY.find((entry) => `builtin:${entry.id}` === cloudAssetId)
                  ?.sourceUrl ?? null;
            }
          }

          const resolvedSourceUrl =
            element.sourceUrl ??
            builtinSourceUrl ??
            (cloudAssetId ? (callbacksRef.current.resolveAssetUrl(cloudAssetId) ?? null) : null);

          if (resolvedSourceUrl) {
            const texture = mapEditTextureCacheRef.current.get(resolvedSourceUrl);

            if (texture) {
              const sprite = new Sprite(texture);
              sprite.anchor.set(0.5, 0.5);
              sprite.width = element.width;
              sprite.height = element.height;
              sprite.alpha = clamp(element.opacity, 0.1, 1);
              content.addChild(sprite);
            } else {
              if (!mapEditTextureLoadingRef.current.has(resolvedSourceUrl)) {
                mapEditTextureLoadingRef.current.add(resolvedSourceUrl);

                void loadTextureFromUrl(resolvedSourceUrl)
                  .then((loadedTexture) => {
                    if (cancelled) {
                      loadedTexture.destroy(true);
                      return;
                    }

                    mapEditTextureCacheRef.current.set(resolvedSourceUrl, loadedTexture);
                    setMapEditTexturesVersion((previous) => previous + 1);
                  })
                  .catch((error) => {
                    if (!cancelled) {
                      console.error('Map edit image could not be loaded', error);
                    }
                  })
                  .finally(() => {
                    mapEditTextureLoadingRef.current.delete(resolvedSourceUrl);
                  });
              }
            }
          }

          if (content.children.length === 0) {
            const placeholder = new Graphics();
            placeholder.rect(
              -element.width / 2,
              -element.height / 2,
              element.width,
              element.height
            );
            placeholder.fill({
              color: 0x1e293b,
              alpha: 0.5
            });
            placeholder.stroke({
              color: 0x94a3b8,
              width: 1.2,
              alpha: 0.9
            });
            content.addChild(placeholder);
          }
        } else if (element.type === 'TEXT') {
          const textNode = new Text({
            text: element.text,
            style: {
              fill: element.color,
              fontFamily: sanitizeFontFamily(element.fontFamily),
              fontSize: clamp(element.fontSize, 8, 240),
              lineHeight: clamp(element.fontSize, 8, 240) * clamp(element.lineHeight, 0.7, 4),
              align: element.align
            }
          });
          textNode.anchor.set(0.5, 0.5);
          textNode.alpha = clamp(element.opacity, 0.1, 1);
          content.addChild(textNode);
        } else if (element.type !== 'ERASE_PATH') {
          const graphic = new Graphics();

          if (element.type === 'PATH') {
            if (element.points.length >= 1) {
              const radius = clamp(element.strokeWidth, 1, 64) / 2;
              for (const point of element.points) {
                graphic.circle(point.x, point.y, radius);
              }

              graphic.fill({
                color: parseHexColor(element.color, 0x38bdf8),
                alpha: clamp(element.opacity * mapEditBrushAlphaFactor[element.brush], 0.08, 1)
              });
            }
          } else if (element.type === 'LINE') {
            graphic.moveTo(element.from.x, element.from.y);
            graphic.lineTo(element.to.x, element.to.y);
            graphic.stroke({
              color: parseHexColor(element.color, 0x38bdf8),
              width: clamp(element.strokeWidth, 1, 64),
              alpha: clamp(element.opacity, 0.1, 1)
            });
          } else if (element.type === 'RECT') {
            graphic.rect(-element.width / 2, -element.height / 2, element.width, element.height);
            graphic.fill({
              color: parseHexColor(element.fillColor, 0x38bdf8),
              alpha: 0.2 * clamp(element.opacity, 0.1, 1)
            });
            graphic.stroke({
              color: parseHexColor(element.strokeColor, 0x38bdf8),
              width: clamp(element.strokeWidth, 1, 64),
              alpha: clamp(element.opacity, 0.1, 1)
            });
          } else {
            graphic.ellipse(0, 0, element.width / 2, element.height / 2);
            graphic.fill({
              color: parseHexColor(element.fillColor, 0x38bdf8),
              alpha: 0.2 * clamp(element.opacity, 0.1, 1)
            });
            graphic.stroke({
              color: parseHexColor(element.strokeColor, 0x38bdf8),
              width: clamp(element.strokeWidth, 1, 64),
              alpha: clamp(element.opacity, 0.1, 1)
            });
          }

          content.addChild(graphic);
        }

        if (element.type !== 'ERASE_PATH') {
          const eraseStrokes = element.eraseStrokes ?? [];
          if (eraseStrokes.length > 0) {
            const eraseMask = new Graphics();
            eraseMask.eventMode = 'none';

            for (const stroke of eraseStrokes) {
              if (stroke.points.length === 0) {
                continue;
              }

              const radius = clamp(stroke.strokeWidth, 1, 128) / 2;
              for (const point of stroke.points) {
                eraseMask.circle(point.x, point.y, radius);
              }
            }

            eraseMask.fill({
              color: 0xffffff,
              alpha: 1
            });
            content.setMask({
              mask: eraseMask,
              inverse: true
            });
            container.addChild(eraseMask);
          }

          container.addChild(content);
        }

        if (selectedMapEditElementId === element.id && element.type !== 'ERASE_PATH') {
          const selection = new Graphics();

          if (element.type === 'RECT' || element.type === 'IMAGE' || element.type === 'TEXT') {
            selection.rect(-element.width / 2, -element.height / 2, element.width, element.height);
          } else if (element.type === 'ELLIPSE') {
            selection.ellipse(0, 0, element.width / 2, element.height / 2);
          } else if (element.type === 'LINE') {
            selection.moveTo(element.from.x, element.from.y);
            selection.lineTo(element.to.x, element.to.y);
          } else if (element.points.length >= 1) {
            const radius = clamp(element.strokeWidth, 1, 64) / 2;
            for (const point of element.points) {
              selection.circle(point.x, point.y, radius);
            }
          }

          selection.stroke({
            color: 0xfacc15,
            width: 2,
            alpha: 0.95
          });
          container.addChild(selection);
        }

        if (!isErasePath) {
          container.on('pointerdown', (event: FederatedPointerEvent) => {
            if (!boardSettingsRef.current.mapEditMode || !callbacksRef.current.canEditMap) {
              return;
            }

            const nativeMouseEvent = event.nativeEvent as MouseEvent | undefined;
            if ((nativeMouseEvent?.button ?? -1) !== 0) {
              return;
            }
            const clickCount = nativeMouseEvent?.detail ?? 1;

            if (
              element.type === 'TEXT' &&
              (mapEditorToolRef.current === 'TEXT' ||
                (mapEditorToolRef.current === 'SELECT' && clickCount >= 2))
            ) {
              event.stopPropagation();
              openTextEditorForExisting({
                element,
                screenX: event.global.x,
                screenY: event.global.y
              });
              return;
            }

            if (mapEditorToolRef.current !== 'SELECT') {
              return;
            }

            event.stopPropagation();

            const world = worldRef.current;
            if (!world) {
              return;
            }

            const worldPoint = world.toLocal(event.global);
            setSelectedMapEditElementId(element.id);
            mapElementDragRef.current = {
              pointerId: event.pointerId,
              elementId: element.id,
              startPointer: {
                x: worldPoint.x,
                y: worldPoint.y
              },
              startElementX: element.x,
              startElementY: element.y,
              snapshotBefore: cloneMapEditElements(mapEditElementsRef.current),
              moved: false
            };
            if (appRef.current) {
              appRef.current.canvas.style.cursor = 'grabbing';
            }
          });
        }

        mapEditLayer.addChild(container);
      }
    };

    renderMapEdits();

    return () => {
      cancelled = true;
      mapEditLayer.removeChildren();
    };
  }, [
    boardSettings.mapEditMode,
    canEditMap,
    mapEditElements,
    mapEditTexturesVersion,
    mapEditorTool,
    selectedMapEditElementId
  ]);

  useEffect(() => {
    const tokenLayer = tokenLayerRef.current;
    const world = worldRef.current;

    if (!tokenLayer || !world) {
      return;
    }

    let cancelled = false;

    const renderTokens = () => {
      if (cancelled) {
        return;
      }

      tokenLayer.removeChildren();

      const tokenGroups = new Map<string, VttToken[]>();
      for (const token of tokens) {
        const snapped = snapToGrid(token.x, token.y, boardSettings);
        const group = tokenGroups.get(snapped.key);
        if (group) {
          group.push(token);
        } else {
          tokenGroups.set(snapped.key, [token]);
        }
      }

      const stackInfoByTokenId = new Map<string, { index: number; total: number }>();
      for (const group of tokenGroups.values()) {
        const sorted = [...group].sort((a, b) => {
          if (a.elevation !== b.elevation) {
            return a.elevation - b.elevation;
          }

          return a.id.localeCompare(b.id);
        });

        sorted.forEach((token, index) => {
          stackInfoByTokenId.set(token.id, {
            index,
            total: sorted.length
          });
        });
      }

      for (const token of tokens) {
        const radius = Math.max(14, token.size * TOKEN_PIXEL_SCALE * 0.5);
        const canMove = canMoveToken(token);
        const stackInfo = stackInfoByTokenId.get(token.id) ?? {
          index: 0,
          total: 1
        };
        const fanOffset = getFanOffset({
          mode: boardSettings.stackDisplay,
          index: stackInfo.index,
          total: stackInfo.total,
          cellSizePx: boardSettings.cellSizePx
        });

        const tokenContainer = new Container();
        tokenContainer.x = token.x;
        tokenContainer.y = token.y;
        tokenContainer.zIndex = token.elevation * 100 + stackInfo.index;
        tokenContainer.eventMode = 'static';
        tokenContainer.cursor = canMove && !boardSettings.mapEditMode ? 'grab' : 'default';

        const visualContainer = new Container();
        visualContainer.x = fanOffset.x;
        visualContainer.y = fanOffset.y;

        const tokenImageTexture = token.assetId
          ? tokenTextureCacheRef.current.get(token.assetId)
          : undefined;
        const tokenStroke = new Graphics();

        if (tokenImageTexture) {
          const imageSprite = new Sprite(tokenImageTexture);
          imageSprite.anchor.set(0.5, 0.5);
          const textureWidth = Math.max(1, tokenImageTexture.width);
          const textureHeight = Math.max(1, tokenImageTexture.height);
          const coverScale = (radius * 2) / Math.min(textureWidth, textureHeight);
          const customScale = Number.isFinite(token.imageScale) ? token.imageScale : 1;

          imageSprite.scale.set(coverScale * customScale);
          imageSprite.x = Number.isFinite(token.imageOffsetX) ? token.imageOffsetX : 0;
          imageSprite.y = Number.isFinite(token.imageOffsetY) ? token.imageOffsetY : 0;
          imageSprite.rotation = degToRad(
            Number.isFinite(token.imageRotationDeg) ? token.imageRotationDeg : 0
          );

          const imageMask = new Graphics();
          imageMask.circle(0, 0, radius);
          imageMask.fill({
            color: 0xffffff
          });

          imageSprite.mask = imageMask;
          visualContainer.addChild(imageSprite);
          visualContainer.addChild(imageMask);

          tokenStroke.circle(0, 0, radius);
          tokenStroke.stroke({
            color: 0xe2e8f0,
            width: 1.8,
            alpha: 0.95
          });
        } else {
          const tokenBody = new Graphics();
          tokenBody.circle(0, 0, radius);
          tokenBody.fill({
            color: parseTokenColor(token.color, token.kind),
            alpha: 0.95
          });
          tokenBody.stroke({
            color: 0xe2e8f0,
            width: 1.2,
            alpha: 0.9
          });
          visualContainer.addChild(tokenBody);
        }

        const tokenLabel = new Text({
          text: token.name,
          style: {
            fill: '#f8fafc',
            fontSize: 11,
            fontFamily: 'monospace'
          }
        });

        tokenLabel.anchor.set(0.5, 0);
        tokenLabel.y = radius + 4;

        visualContainer.addChild(tokenStroke);
        visualContainer.addChild(tokenLabel);

        if (token.elevation > 0) {
          const elevationLabel = new Text({
            text: `+${token.elevation}`,
            style: {
              fill: '#e2e8f0',
              fontSize: 10,
              fontFamily: 'monospace'
            }
          });

          elevationLabel.anchor.set(0.5, 0.5);
          elevationLabel.y = -radius - 10;
          visualContainer.addChild(elevationLabel);
        }

        tokenContainer.addChild(visualContainer);

        tokenContainer.on('pointerdown', (event: FederatedPointerEvent) => {
          event.stopPropagation();

          if (boardSettingsRef.current.mapEditMode) {
            return;
          }

          const nativeMouseEvent = event.nativeEvent as MouseEvent | undefined;
          const button = nativeMouseEvent?.button ?? -1;

          if (button === 2) {
            const appInstance = appRef.current;
            if (!appInstance) {
              return;
            }

            const clientX = nativeMouseEvent?.clientX ?? event.global.x;
            const clientY = nativeMouseEvent?.clientY ?? event.global.y;
            nativeMouseEvent?.preventDefault();

            const snapped = snapToGrid(token.x, token.y, boardSettingsRef.current);
            const canvasRect = appInstance.canvas.getBoundingClientRect();

            setContextMenu({
              x: clientX - canvasRect.left,
              y: clientY - canvasRect.top,
              worldX: snapped.centerX,
              worldY: snapped.centerY,
              tokenId: token.id
            });
            setTokenModal(null);
            setTokenFormError(null);
            return;
          }

          if (!callbacksRef.current.canMoveToken(token)) {
            return;
          }

          if (button !== 0) {
            return;
          }

          const point = world.toLocal(event.global);

          tokenContainer.cursor = 'grabbing';
          dragStateRef.current = {
            tokenId: token.id,
            offsetX: point.x - tokenContainer.x,
            offsetY: point.y - tokenContainer.y
          };
        });

        tokenContainer.on('pointerup', () => {
          tokenContainer.cursor = callbacksRef.current.canMoveToken(token) ? 'grab' : 'default';
        });

        tokenContainer.on('pointerupoutside', () => {
          tokenContainer.cursor = callbacksRef.current.canMoveToken(token) ? 'grab' : 'default';
        });

        tokenLayer.addChild(tokenContainer);
      }
    };

    const loadTokenTextures = async () => {
      const tokenAssetIds = [
        ...new Set(
          tokens.map((token) => token.assetId).filter((assetId): assetId is string => !!assetId)
        )
      ];

      await Promise.all(
        tokenAssetIds.map(async (assetId) => {
          if (tokenTextureCacheRef.current.has(assetId)) {
            return;
          }

          const assetUrl = callbacksRef.current.resolveAssetUrl(assetId);

          if (!assetUrl) {
            return;
          }

          try {
            const texture = await loadTextureFromUrl(assetUrl);
            if (cancelled) {
              texture.destroy(true);
              return;
            }

            tokenTextureCacheRef.current.set(assetId, texture);
          } catch (error) {
            if (!cancelled) {
              console.error('Token image could not be loaded', error);
            }
          }
        })
      );
    };

    void loadTokenTextures().then(() => {
      renderTokens();
    });

    return () => {
      cancelled = true;
      tokenLayer.removeChildren();
    };
  }, [boardSettings, canMoveToken, resolveAssetUrl, tokens]);

  useEffect(() => {
    const closeOverlaysOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      const isEditableMapMode =
        boardSettingsRef.current.mapEditMode && callbacksRef.current.canEditMap;
      if (isEditableMapMode && mapEditGestureRef.current?.kind === 'POLYLINE') {
        event.preventDefault();
        finishPolylineGesture(true);
      }

      if (isEditableMapMode) {
        setMapEditorTool('PAN');
        setPendingMapImage(null);
      }

      setContextMenu(null);
      setTokenModal(null);
      setTokenFormError(null);
      setSelectedMapEditElementId(null);
      setTextEditor(null);
      mapEditGestureRef.current = null;
      mapElementDragRef.current = null;
      clearMapEditPreview();
      mapEditBrushCursorRef.current?.clear();
    };

    window.addEventListener('keydown', closeOverlaysOnEscape);

    return () => {
      window.removeEventListener('keydown', closeOverlaysOnEscape);
    };
  }, [clearMapEditPreview, finishPolylineGesture]);

  useEffect(() => {
    const file = tokenModal?.imageFile ?? null;
    const sourceUrl = file ? URL.createObjectURL(file) : (tokenModal?.existingImageUrl ?? null);
    const shouldRevokeSourceUrl = Boolean(file);

    if (!sourceUrl) {
      setTokenPreviewUrl(null);
      setTokenPreviewDimensions(null);
      return;
    }

    setTokenPreviewUrl(sourceUrl);
    setTokenPreviewDimensions(null);
    const image = new Image();
    let active = true;

    image.onload = () => {
      if (!active) {
        return;
      }

      setTokenPreviewDimensions({
        width: Math.max(1, image.naturalWidth),
        height: Math.max(1, image.naturalHeight)
      });
    };

    image.onerror = () => {
      if (!active) {
        return;
      }

      setTokenPreviewDimensions(null);
    };

    image.src = sourceUrl;

    return () => {
      active = false;
      if (shouldRevokeSourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [tokenModal?.existingImageUrl, tokenModal?.imageFile]);

  useEffect(() => {
    const handleMapEditShortcuts = (event: KeyboardEvent) => {
      if (!boardSettingsRef.current.mapEditMode || !callbacksRef.current.canEditMap) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase();
        if (
          target.isContentEditable ||
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select'
        ) {
          return;
        }
      }

      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (!isModifierPressed) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoMapEdit();
        return;
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoMapEdit();
      }
    };

    window.addEventListener('keydown', handleMapEditShortcuts);
    return () => {
      window.removeEventListener('keydown', handleMapEditShortcuts);
    };
  }, [redoMapEdit, undoMapEdit]);

  useEffect(() => {
    if (!selectedMapEditElementId) {
      return;
    }

    const selectedExists = mapEditElements.some(
      (element) => element.id === selectedMapEditElementId
    );
    if (!selectedExists) {
      setSelectedMapEditElementId(null);
    }
  }, [mapEditElements, selectedMapEditElementId]);

  useEffect(() => {
    if (mapObjectLibrary.length === 0) {
      return;
    }

    const selectedExists = mapObjectLibrary.some((entry) => entry.id === selectedMapObjectId);
    if (!selectedExists) {
      const fallback = mapObjectLibrary[0];
      if (fallback) {
        setSelectedMapObjectId(fallback.id);
      }
    }
  }, [mapObjectLibrary, selectedMapObjectId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const customEntries = mapObjectLibrary
      .filter((entry) => !entry.builtin)
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        sourceUrl: entry.sourceUrl,
        imageRef: entry.imageRef,
        width: entry.width,
        height: entry.height
      }));

    window.localStorage.setItem(MAP_OBJECT_LIBRARY_STORAGE_KEY, JSON.stringify(customEntries));
  }, [mapObjectLibrary]);

  useEffect(() => {
    if (boardSettings.mapEditMode) {
      return;
    }

    if (mapEditGestureRef.current?.kind === 'POLYLINE') {
      finishPolylineGesture(false);
    } else {
      mapEditGestureRef.current = null;
    }
    mapElementDragRef.current = null;
    setTextEditor(null);
    clearMapEditPreview();
    mapEditBrushCursorRef.current?.clear();
  }, [boardSettings.mapEditMode, clearMapEditPreview, finishPolylineGesture]);

  useEffect(() => {
    if (!boardSettings.mapEditMode) {
      return;
    }

    setContextMenu(null);
    setTokenModal(null);
    setTokenFormError(null);
    setTextEditor(null);
  }, [boardSettings.mapEditMode]);

  useEffect(() => {
    const previousTool = previousMapEditorToolRef.current;
    if (previousTool === 'LINE' && mapEditorTool !== 'LINE') {
      finishPolylineGesture(true);
    }

    previousMapEditorToolRef.current = mapEditorTool;
  }, [finishPolylineGesture, mapEditorTool]);

  const triggerMapImageSelection = () => {
    if (!canEditMap) {
      return;
    }

    mapImageInputRef.current?.click();
  };

  const triggerMapObjectSelection = () => {
    if (!canEditMap) {
      return;
    }

    mapObjectInputRef.current?.click();
  };

  const handleMapImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    let sourceUrl = URL.createObjectURL(file);
    let imageRef: ImageRef = {
      kind: 'CLOUD_ASSET',
      assetId: `inline:${createMapEditId()}`
    };

    if (callbacksRef.current.prepareMapEditImageAsset) {
      const prepared = await callbacksRef.current.prepareMapEditImageAsset(file, 'MAP_EDIT_IMAGE');
      if (!prepared) {
        URL.revokeObjectURL(sourceUrl);
        return;
      }

      URL.revokeObjectURL(sourceUrl);
      sourceUrl = prepared.sourceUrl;
      imageRef = prepared.imageRef;
    }

    if (sourceUrl.startsWith('blob:')) {
      mapEditObjectUrlsRef.current.add(sourceUrl);
    }

    const image = new Image();

    image.onload = () => {
      const maxDimension = 240;
      const safeWidth = Math.max(1, image.naturalWidth);
      const safeHeight = Math.max(1, image.naturalHeight);
      const fitScale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));

      setPendingMapImage({
        sourceUrl,
        imageRef,
        width: Math.max(24, Math.round(safeWidth * fitScale)),
        height: Math.max(24, Math.round(safeHeight * fitScale)),
        label: file.name
      });
      setMapEditorTool('IMAGE');
    };

    image.onerror = () => {
      setPendingMapImage(null);
      if (sourceUrl.startsWith('blob:')) {
        URL.revokeObjectURL(sourceUrl);
        mapEditObjectUrlsRef.current.delete(sourceUrl);
      }
    };

    image.src = sourceUrl;
  };

  const handleMapObjectSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    let preparedImageRef: ImageRef | null = null;
    if (callbacksRef.current.prepareMapEditImageAsset) {
      const prepared = await callbacksRef.current.prepareMapEditImageAsset(file, 'OBJECT');
      if (!prepared) {
        return;
      }

      preparedImageRef = prepared.imageRef;
      if (prepared.sourceUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prepared.sourceUrl);
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return;
      }

      const image = new Image();
      image.onload = () => {
        const maxDimension = 256;
        const safeWidth = Math.max(1, image.naturalWidth);
        const safeHeight = Math.max(1, image.naturalHeight);
        const fitScale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));
        const width = Math.max(24, Math.round(safeWidth * fitScale));
        const height = Math.max(24, Math.round(safeHeight * fitScale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          return;
        }

        context.imageSmoothingEnabled = true;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const compactDataUrl = canvas.toDataURL('image/png');
        const entry: MapObjectLibraryItem = {
          id: createMapEditId(),
          label: file.name.slice(0, 80) || 'Object',
          sourceUrl: compactDataUrl,
          imageRef:
            preparedImageRef ??
            ({
              kind: 'CLOUD_ASSET',
              assetId: `inline:${createMapEditId()}`
            } satisfies ImageRef),
          width,
          height,
          builtin: false
        };

        setMapObjectLibrary((previous) => {
          const builtins = previous.filter((item) => item.builtin);
          const custom = [...previous.filter((item) => !item.builtin), entry].slice(
            -MAX_CUSTOM_MAP_OBJECTS
          );
          return [...builtins, ...custom];
        });
        setSelectedMapObjectId(entry.id);
        setMapEditorTool('OBJECT');
      };

      image.onerror = () => {
        // Ignore broken uploads and keep the existing library untouched.
      };

      image.src = dataUrl;
    };

    reader.readAsDataURL(file);
  };

  const clearPendingMapImage = () => {
    setPendingMapImage(null);
  };

  const removeSelectedMapEditElement = () => {
    if (!selectedMapEditElementId) {
      return;
    }

    commitMapEditOperations(
      [
        {
          kind: 'DELETE',
          elementIds: [selectedMapEditElementId]
        }
      ],
      {
        immediate: true
      }
    );
    setSelectedMapEditElementId(null);
  };

  const openTokenCreateModal = () => {
    if (!contextMenu) {
      return;
    }

    setTokenModal({
      mode: 'CREATE',
      tokenId: null,
      worldX: contextMenu.worldX,
      worldY: contextMenu.worldY,
      draft: {
        name: 'Token',
        kind: 'NEUTRAL',
        color: defaultTokenColor('NEUTRAL'),
        elevation: 0,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotationDeg: 0
      },
      imageFile: null,
      existingImageUrl: null,
      hasCustomColor: false
    });
    setTokenFormError(null);
    setContextMenu(null);
  };

  const openTokenEditModal = (token: VttToken) => {
    if (!callbacksRef.current.canEditToken(token)) {
      return;
    }

    const defaultColor = defaultTokenColor(token.kind);
    const resolvedColor = token.color ?? defaultColor;
    const existingImageUrl = token.assetId
      ? callbacksRef.current.resolveAssetUrl(token.assetId)
      : null;

    setTokenModal({
      mode: 'EDIT',
      tokenId: token.id,
      worldX: token.x,
      worldY: token.y,
      draft: {
        name: token.name,
        kind: token.kind,
        color: resolvedColor,
        elevation: token.elevation,
        assetId: token.assetId,
        imageOffsetX: Number.isFinite(token.imageOffsetX) ? token.imageOffsetX : 0,
        imageOffsetY: Number.isFinite(token.imageOffsetY) ? token.imageOffsetY : 0,
        imageScale: Number.isFinite(token.imageScale) ? token.imageScale : 1,
        imageRotationDeg: Number.isFinite(token.imageRotationDeg) ? token.imageRotationDeg : 0
      },
      imageFile: null,
      existingImageUrl,
      hasCustomColor: resolvedColor.toLowerCase() !== defaultColor.toLowerCase()
    });
    setTokenFormError(null);
    setContextMenu(null);
  };

  const submitTokenModal = async () => {
    if (!tokenModal || isSubmittingToken) {
      return;
    }

    if (tokenModal.mode === 'CREATE' && !canCreateToken) {
      return;
    }

    if (
      tokenModal.mode === 'EDIT' &&
      (!tokenModal.tokenId ||
        !tokens.some(
          (token) => token.id === tokenModal.tokenId && callbacksRef.current.canEditToken(token)
        ))
    ) {
      return;
    }

    setIsSubmittingToken(true);
    setTokenFormError(null);

    try {
      if (tokenModal.mode === 'CREATE') {
        await onCreateToken(
          tokenModal.worldX,
          tokenModal.worldY,
          tokenModal.draft,
          tokenModal.imageFile
        );
      } else if (tokenModal.tokenId) {
        await onUpdateToken(tokenModal.tokenId, tokenModal.draft, tokenModal.imageFile);
      }
      setTokenModal(null);
    } catch (error) {
      setTokenFormError(error instanceof Error ? error.message : 'Could not save token');
    } finally {
      setIsSubmittingToken(false);
    }
  };

  useEffect(() => {
    if (!tokenEditRequest) {
      return;
    }

    if (handledTokenEditRequestRef.current === tokenEditRequest.requestId) {
      return;
    }

    handledTokenEditRequestRef.current = tokenEditRequest.requestId;
    const token = tokens.find((entry) => entry.id === tokenEditRequest.tokenId);
    if (!token) {
      return;
    }

    openTokenEditModal(token);
  }, [tokenEditRequest, tokens]);

  const contextMenuToken = useMemo(() => {
    if (!contextMenu?.tokenId) {
      return null;
    }

    return tokens.find((entry) => entry.id === contextMenu.tokenId) ?? null;
  }, [contextMenu?.tokenId, tokens]);

  const textEditorViewportWidth = mountRef.current?.clientWidth ?? 360;
  const textEditorViewportHeight = mountRef.current?.clientHeight ?? 360;
  const textEditorPanelWidth = Math.min(360, Math.max(1, textEditorViewportWidth - 16));
  const textEditorPanelMaxHeight = Math.min(420, Math.max(1, textEditorViewportHeight - 16));
  const textEditorPanelEstimatedHeight = Math.min(textEditorPanelMaxHeight, 320);
  const textEditorMargin = 8;
  const textEditorGap = 24;
  const maxTextEditorLeft = Math.max(
    textEditorMargin,
    textEditorViewportWidth - textEditorPanelWidth - textEditorMargin
  );
  const maxTextEditorTop = Math.max(
    textEditorMargin,
    textEditorViewportHeight - textEditorPanelMaxHeight - textEditorMargin
  );
  const resolveAnchoredTextEditorPosition = (screenX: number, screenY: number) => {
    let left = screenX + textEditorGap;
    if (left + textEditorPanelWidth > textEditorViewportWidth - textEditorMargin) {
      left = screenX - textEditorPanelWidth - textEditorGap;
    }

    let top = screenY - textEditorPanelEstimatedHeight - textEditorGap;
    if (top < textEditorMargin) {
      top = screenY + textEditorGap;
    }

    return {
      left: clamp(left, textEditorMargin, maxTextEditorLeft),
      top: clamp(top, textEditorMargin, maxTextEditorTop)
    };
  };
  const anchoredTextEditorPosition = textEditor
    ? resolveAnchoredTextEditorPosition(textEditor.screenX, textEditor.screenY)
    : { left: textEditorMargin, top: textEditorMargin };
  const textEditorLeft = textEditor
    ? clamp(
        textEditor.panelLeft ?? anchoredTextEditorPosition.left,
        textEditorMargin,
        maxTextEditorLeft
      )
    : textEditorMargin;
  const textEditorTop = textEditor
    ? clamp(
        textEditor.panelTop ?? anchoredTextEditorPosition.top,
        textEditorMargin,
        maxTextEditorTop
      )
    : textEditorMargin;

  const beginTextEditorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!textEditor) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    textEditorDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - textEditorLeft,
      offsetY: event.clientY - textEditorTop
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveTextEditorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = textEditorDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const mountRect = mountRef.current?.getBoundingClientRect();
    if (!mountRect) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    const nextLeft = clamp(
      event.clientX - mountRect.left - drag.offsetX,
      textEditorMargin,
      maxTextEditorLeft
    );
    const nextTop = clamp(
      event.clientY - mountRect.top - drag.offsetY,
      textEditorMargin,
      maxTextEditorTop
    );
    setTextEditor((previous) =>
      previous
        ? {
            ...previous,
            panelLeft: nextLeft,
            panelTop: nextTop
          }
        : previous
    );
  };

  const endTextEditorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = textEditorDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    textEditorDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className="relative h-full min-h-[520px] overflow-hidden rounded border border-slate-300 shadow-inner shadow-black/15 dark:border-slate-700 dark:shadow-black/40"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={mountRef} className="h-full w-full" />

      <input
        ref={mapImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleMapImageSelection}
      />
      <input
        ref={mapObjectInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleMapObjectSelection}
      />

      {boardSettings.mapEditMode ? (
        <div className="absolute left-1/2 top-3 z-20 w-[min(96%,1080px)] -translate-x-1/2 rounded border border-slate-700 bg-slate-900/95 p-2 text-slate-100 shadow-xl">
          {!canEditMap ? (
            <p className="text-xs text-amber-300">
              Map edit is active, but your role is currently read-only.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ['PAN', 'Pan'],
                    ['PAN_MAP', 'Pan Map'],
                    ['SELECT', 'Select'],
                    ['DRAW', 'Draw'],
                    ['ERASE', 'Erase'],
                    ['LINE', 'Line'],
                    ['RECT', 'Rect'],
                    ['ELLIPSE', 'Ellipse'],
                    ['IMAGE', 'Image'],
                    ['OBJECT', 'Objects'],
                    ['TEXT', 'Text']
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded px-2 py-1 text-xs ${
                      mapEditorTool === value
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                    onClick={() => setMapEditorTool(value)}
                  >
                    {label}
                  </button>
                ))}

                <label className="ml-2 flex items-center gap-1 text-[11px]">
                  Stroke
                  <input
                    type="color"
                    value={mapEditorStrokeColor}
                    className="h-7 w-8 rounded border border-slate-600 bg-slate-800 p-0.5"
                    onChange={(event) => setMapEditorStrokeColor(event.target.value)}
                  />
                </label>

                <label className="flex items-center gap-1 text-[11px]">
                  Fill
                  <input
                    type="color"
                    value={mapEditorFillColor}
                    className="h-7 w-8 rounded border border-slate-600 bg-slate-800 p-0.5"
                    onChange={(event) => setMapEditorFillColor(event.target.value)}
                  />
                </label>

                <label className="flex items-center gap-1 text-[11px]">
                  Width
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={mapEditorStrokeWidth}
                    className="w-14 rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
                    onChange={(event) => {
                      const value = Number.parseFloat(event.target.value);
                      setMapEditorStrokeWidth(Number.isFinite(value) ? clamp(value, 1, 64) : 6);
                    }}
                  />
                </label>

                {mapEditorTool === 'DRAW' || mapEditorTool === 'ERASE' ? (
                  <div className="ml-1 flex items-center gap-1 text-[11px]">
                    <span className="text-slate-300">Brush</span>
                    {(['PEN', 'MARKER', 'CHALK'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`rounded px-2 py-1 text-[10px] ${
                          mapEditorBrush === preset
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                        onClick={() => setMapEditorBrush(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                ) : null}

                {mapEditorTool === 'DRAW' || mapEditorTool === 'ERASE' ? (
                  <span className="ml-1 text-[10px] text-slate-300">
                    Ctrl + Mouse wheel: brush size
                  </span>
                ) : null}

                {mapEditorTool === 'TEXT' ? (
                  <div className="ml-1 flex items-center gap-1 text-[11px]">
                    <select
                      value={sanitizeFontFamily(mapEditorTextFontFamily)}
                      className="max-w-[140px] rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
                      onChange={(event) =>
                        setMapEditorTextFontFamily(sanitizeFontFamily(event.target.value))
                      }
                    >
                      {TEXT_FONT_FAMILIES.map((font) => (
                        <option key={font} value={font}>
                          {font.split(',')[0]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={8}
                      max={240}
                      value={mapEditorTextSize}
                      className="w-14 rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value);
                        setMapEditorTextSize(Number.isFinite(value) ? clamp(value, 8, 240) : 28);
                      }}
                    />
                    <input
                      type="number"
                      min={0.7}
                      max={4}
                      step={0.05}
                      value={mapEditorTextLineHeight}
                      className="w-14 rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value);
                        setMapEditorTextLineHeight(
                          Number.isFinite(value) ? clamp(value, 0.7, 4) : 1.2
                        );
                      }}
                    />
                    <select
                      value={mapEditorTextAlign}
                      className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
                      onChange={(event) =>
                        setMapEditorTextAlign(event.target.value as MapTextAlign)
                      }
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                  onClick={triggerMapImageSelection}
                >
                  Load Image
                </button>

                {mapEditorTool === 'OBJECT' ? (
                  <button
                    type="button"
                    className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                    onClick={triggerMapObjectSelection}
                  >
                    Upload Object
                  </button>
                ) : null}

                <button
                  type="button"
                  className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600 disabled:opacity-40"
                  onClick={undoMapEdit}
                  disabled={mapEditUndoStackRef.current.length === 0}
                >
                  Undo
                </button>

                <button
                  type="button"
                  className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600 disabled:opacity-40"
                  onClick={redoMapEdit}
                  disabled={mapEditRedoStackRef.current.length === 0}
                >
                  Redo
                </button>

                <button
                  type="button"
                  className="rounded bg-rose-700 px-2 py-1 text-xs hover:bg-rose-600 disabled:opacity-40"
                  onClick={() => {
                    commitMapEditOperations(
                      [
                        {
                          kind: 'CLEAR'
                        }
                      ],
                      {
                        immediate: true
                      }
                    );
                    setSelectedMapEditElementId(null);
                  }}
                  disabled={mapEditElements.length === 0}
                >
                  Clear All
                </button>
              </div>

              {pendingMapImage ? (
                <div className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300">
                  <span className="min-w-0 truncate">
                    Pending image: {pendingMapImage.label} ({pendingMapImage.width}x
                    {pendingMapImage.height})
                  </span>
                  <button
                    type="button"
                    className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                    onClick={clearPendingMapImage}
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              {mapEditorTool === 'OBJECT' ? (
                <div className="space-y-2 rounded border border-slate-700 bg-slate-800/80 p-2 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span>Objects library ({mapObjectLibrary.length})</span>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-1 text-[10px] hover:bg-slate-600"
                      onClick={triggerMapObjectSelection}
                    >
                      Add
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {mapObjectLibrary.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`relative flex min-h-[74px] flex-col items-center justify-center gap-1 rounded border p-1 text-[10px] ${
                          selectedMapObject?.id === entry.id
                            ? 'border-sky-400 bg-sky-900/30'
                            : 'border-slate-600 bg-slate-900/70 hover:border-slate-500'
                        }`}
                        onClick={() => {
                          setSelectedMapObjectId(entry.id);
                        }}
                      >
                        <img
                          src={entry.sourceUrl}
                          alt={entry.label}
                          className="h-10 w-10 rounded object-contain"
                          draggable={false}
                        />
                        <span className="max-w-full truncate">{entry.label}</span>
                        {!entry.builtin ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="absolute right-1 top-1 rounded bg-slate-900/90 px-1 text-[9px] text-rose-300"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMapObjectLibrary((previous) =>
                                previous.filter((item) => item.id !== entry.id)
                              );
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                setMapObjectLibrary((previous) =>
                                  previous.filter((item) => item.id !== entry.id)
                                );
                              }
                            }}
                          >
                            x
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedMapEditElement ? (
                <div className="grid grid-cols-6 gap-2 rounded border border-slate-700 bg-slate-800/80 p-2 text-[11px]">
                  <label className="col-span-1">
                    X
                    <input
                      type="number"
                      value={Math.round(selectedMapEditElement.x)}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        updateSelectedMapEditElement((element) => ({
                          ...element,
                          x: value
                        }));
                      }}
                    />
                  </label>

                  <label className="col-span-1">
                    Y
                    <input
                      type="number"
                      value={Math.round(selectedMapEditElement.y)}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        updateSelectedMapEditElement((element) => ({
                          ...element,
                          y: value
                        }));
                      }}
                    />
                  </label>

                  <label className="col-span-1">
                    Scale
                    <input
                      type="number"
                      min={0.1}
                      max={8}
                      step={0.05}
                      value={selectedMapEditElement.scale}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        updateSelectedMapEditElement((element) => ({
                          ...element,
                          scale: clamp(value, 0.1, 8)
                        }));
                      }}
                    />
                  </label>

                  <label className="col-span-1">
                    Rotation
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      value={selectedMapEditElement.rotationDeg}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        updateSelectedMapEditElement((element) => ({
                          ...element,
                          rotationDeg: clamp(value, -180, 180)
                        }));
                      }}
                    />
                  </label>

                  <label className="col-span-1">
                    Opacity
                    <input
                      type="number"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={selectedMapEditElement.opacity}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        updateSelectedMapEditElement((element) => ({
                          ...element,
                          opacity: clamp(value, 0.1, 1)
                        }));
                      }}
                    />
                  </label>

                  {selectedMapEditElement.type === 'TEXT' ? (
                    <label className="col-span-3">
                      Text
                      <textarea
                        rows={3}
                        value={selectedMapEditElement.text}
                        className="mt-1 w-full resize-y rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        onChange={(event) => {
                          const value = event.target.value;
                          updateSelectedMapEditElement((element) => {
                            if (element.type !== 'TEXT') {
                              return element;
                            }

                            const measured = measureMapEditText({
                              text: value || ' ',
                              color: element.color,
                              fontFamily: element.fontFamily,
                              fontSize: element.fontSize,
                              lineHeight: element.lineHeight,
                              align: element.align
                            });

                            return {
                              ...element,
                              text: value || ' ',
                              width: Math.max(1, measured.width),
                              height: Math.max(1, measured.height)
                            };
                          });
                        }}
                      />
                    </label>
                  ) : null}

                  {selectedMapEditElement.type === 'TEXT' ? (
                    <label className="col-span-1">
                      Font
                      <input
                        type="number"
                        min={8}
                        max={240}
                        value={selectedMapEditElement.fontSize}
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        onChange={(event) => {
                          const value = Number.parseFloat(event.target.value);
                          if (!Number.isFinite(value)) {
                            return;
                          }

                          updateSelectedMapEditElement((element) => {
                            if (element.type !== 'TEXT') {
                              return element;
                            }

                            const nextFontSize = clamp(value, 8, 240);
                            const measured = measureMapEditText({
                              text: element.text,
                              color: element.color,
                              fontFamily: element.fontFamily,
                              fontSize: nextFontSize,
                              lineHeight: element.lineHeight,
                              align: element.align
                            });

                            return {
                              ...element,
                              fontSize: nextFontSize,
                              width: Math.max(1, measured.width),
                              height: Math.max(1, measured.height)
                            };
                          });
                        }}
                      />
                    </label>
                  ) : null}

                  {selectedMapEditElement.type === 'TEXT' ? (
                    <label className="col-span-2">
                      Family
                      <select
                        value={sanitizeFontFamily(selectedMapEditElement.fontFamily)}
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        onChange={(event) => {
                          const value = sanitizeFontFamily(event.target.value);
                          updateSelectedMapEditElement((element) => {
                            if (element.type !== 'TEXT') {
                              return element;
                            }

                            const measured = measureMapEditText({
                              text: element.text,
                              color: element.color,
                              fontFamily: value,
                              fontSize: element.fontSize,
                              lineHeight: element.lineHeight,
                              align: element.align
                            });

                            return {
                              ...element,
                              fontFamily: value,
                              width: Math.max(1, measured.width),
                              height: Math.max(1, measured.height)
                            };
                          });
                        }}
                      >
                        {TEXT_FONT_FAMILIES.map((font) => (
                          <option key={font} value={font}>
                            {font.split(',')[0]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {selectedMapEditElement.type === 'TEXT' ? (
                    <label className="col-span-1">
                      Line
                      <input
                        type="number"
                        min={0.7}
                        max={4}
                        step={0.05}
                        value={selectedMapEditElement.lineHeight}
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        onChange={(event) => {
                          const value = Number.parseFloat(event.target.value);
                          if (!Number.isFinite(value)) {
                            return;
                          }

                          updateSelectedMapEditElement((element) => {
                            if (element.type !== 'TEXT') {
                              return element;
                            }

                            const nextLineHeight = clamp(value, 0.7, 4);
                            const measured = measureMapEditText({
                              text: element.text,
                              color: element.color,
                              fontFamily: element.fontFamily,
                              fontSize: element.fontSize,
                              lineHeight: nextLineHeight,
                              align: element.align
                            });

                            return {
                              ...element,
                              lineHeight: nextLineHeight,
                              width: Math.max(1, measured.width),
                              height: Math.max(1, measured.height)
                            };
                          });
                        }}
                      />
                    </label>
                  ) : null}

                  {selectedMapEditElement.type === 'TEXT' ? (
                    <label className="col-span-1">
                      Align
                      <select
                        value={selectedMapEditElement.align}
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        onChange={(event) => {
                          const nextAlign = event.target.value as MapTextAlign;
                          updateSelectedMapEditElement((element) => {
                            if (element.type !== 'TEXT') {
                              return element;
                            }

                            const measured = measureMapEditText({
                              text: element.text,
                              color: element.color,
                              fontFamily: element.fontFamily,
                              fontSize: element.fontSize,
                              lineHeight: element.lineHeight,
                              align: nextAlign
                            });

                            return {
                              ...element,
                              align: nextAlign,
                              width: Math.max(1, measured.width),
                              height: Math.max(1, measured.height)
                            };
                          });
                        }}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  ) : null}

                  <div className="col-span-1 flex items-end">
                    <button
                      type="button"
                      className="w-full rounded bg-rose-700 px-2 py-1 text-xs hover:bg-rose-600"
                      onClick={removeSelectedMapEditElement}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {textEditor ? (
        <div
          className="absolute z-30 box-border overflow-y-auto rounded border border-slate-700 bg-slate-900/95 p-2 text-slate-100 shadow-xl"
          style={{
            left: textEditorLeft,
            top: textEditorTop,
            width: textEditorPanelWidth,
            maxHeight: textEditorPanelMaxHeight
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="mb-2 flex cursor-move items-center justify-between rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs text-slate-300 select-none"
            onPointerDown={beginTextEditorDrag}
            onPointerMove={moveTextEditorDrag}
            onPointerUp={endTextEditorDrag}
            onPointerCancel={endTextEditorDrag}
          >
            <span>
              {textEditor.mode === 'EDIT' ? 'Edit Text' : 'New Text'} (Ctrl + Enter = Apply)
            </span>
            <span className="text-[10px] text-slate-400">drag</span>
          </div>

          <textarea
            ref={textEditorTextareaRef}
            value={textEditor.text}
            rows={5}
            className="w-full resize-y rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs leading-relaxed text-slate-100"
            onChange={(event) =>
              setTextEditor((previous) =>
                previous
                  ? {
                      ...previous,
                      text: event.target.value
                    }
                  : previous
              )
            }
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeTextEditor();
                setMapEditorTool('PAN');
                return;
              }

              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                applyTextEditorChanges();
              }
            }}
            placeholder="Type text..."
          />

          <div className="mt-2 grid grid-cols-1 gap-1 text-[11px]">
            <select
              value={sanitizeFontFamily(textEditor.fontFamily)}
              className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
              onChange={(event) =>
                setTextEditor((previous) =>
                  previous
                    ? {
                        ...previous,
                        fontFamily: sanitizeFontFamily(event.target.value)
                      }
                    : previous
                )
              }
            >
              {TEXT_FONT_FAMILIES.map((font) => (
                <option key={font} value={font}>
                  {font.split(',')[0]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
            <input
              type="number"
              min={8}
              max={240}
              value={textEditor.fontSize}
              className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                setTextEditor((previous) =>
                  previous
                    ? {
                        ...previous,
                        fontSize: Number.isFinite(value) ? clamp(value, 8, 240) : previous.fontSize
                      }
                    : previous
                );
              }}
            />
            <input
              type="number"
              min={0.7}
              max={4}
              step={0.05}
              value={textEditor.lineHeight}
              className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                setTextEditor((previous) =>
                  previous
                    ? {
                        ...previous,
                        lineHeight: Number.isFinite(value)
                          ? clamp(value, 0.7, 4)
                          : previous.lineHeight
                      }
                    : previous
                );
              }}
            />
            <select
              value={textEditor.align}
              className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs"
              onChange={(event) =>
                setTextEditor((previous) =>
                  previous
                    ? {
                        ...previous,
                        align: event.target.value as MapTextAlign
                      }
                    : previous
                )
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <input
              type="color"
              value={textEditor.color}
              className="h-7 w-full rounded border border-slate-600 bg-slate-800 p-0.5"
              onChange={(event) =>
                setTextEditor((previous) =>
                  previous
                    ? {
                        ...previous,
                        color: event.target.value
                      }
                    : previous
                )
              }
            />
          </div>

          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              onClick={closeTextEditor}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
              onClick={applyTextEditorChanges}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-slate-900/75 px-2 py-1 text-[11px] text-slate-200">
        {mapInstruction}
      </div>

      {contextMenu ? (
        <div
          className="absolute inset-0 z-20"
          onClick={() => setContextMenu(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="absolute min-w-44 rounded border border-slate-700 bg-slate-900 p-1 text-sm text-slate-100 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            {contextMenuToken ? (
              <>
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => openTokenEditModal(contextMenuToken)}
                  disabled={!canEditToken(contextMenuToken)}
                >
                  Edit Token
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    if (!onDeleteToken) {
                      return;
                    }

                    onDeleteToken(contextMenuToken.id);
                    setContextMenu(null);
                  }}
                  disabled={!onDeleteToken || !canMoveToken(contextMenuToken)}
                >
                  Delete Token
                </button>
                <div className="my-1 border-t border-slate-700" />
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={openTokenCreateModal}
                  disabled={!canCreateToken}
                >
                  Create Token Here
                </button>
                {!canEditToken(contextMenuToken) ? (
                  <p className="px-3 pb-1 pt-1 text-xs text-slate-400">
                    You do not have permission to edit this token.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={openTokenCreateModal}
                  disabled={!canCreateToken}
                >
                  Create Token
                </button>
                {!canCreateToken ? (
                  <p className="px-3 pb-2 pt-1 text-xs text-slate-400">
                    You do not have permission to create tokens.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {tokenModal ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTokenModal(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <h3 className="text-base font-semibold">Configure Token</h3>
            <p className="mt-1 text-xs text-slate-400">
              {tokenModal.mode === 'CREATE'
                ? 'The token will be created at the selected grid location.'
                : 'Edit the current token settings and apply the changes.'}
            </p>

            <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">
              Faction
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                value={tokenModal.draft.kind}
                onChange={(event) => {
                  const nextKind = event.target.value as TokenDraft['kind'];
                  setTokenModal((previous) => {
                    if (!previous) {
                      return previous;
                    }

                    const nextColor = previous.hasCustomColor
                      ? previous.draft.color
                      : defaultTokenColor(nextKind);

                    return {
                      ...previous,
                      draft: {
                        ...previous.draft,
                        kind: nextKind,
                        color: nextColor
                      },
                      hasCustomColor: previous.hasCustomColor
                    };
                  });
                }}
              >
                <option value="ALLY">Ally</option>
                <option value="ENEMY">Enemy</option>
                <option value="NEUTRAL">Neutral</option>
              </select>
            </label>

            <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
              Name
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                value={tokenModal.draft.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setTokenModal((previous) =>
                    previous
                      ? {
                          ...previous,
                          draft: {
                            ...previous.draft,
                            name: value
                          }
                        }
                      : previous
                  );
                }}
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Color
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-800 p-1"
                  value={tokenModal.draft.color ?? defaultTokenColor(tokenModal.draft.kind)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTokenModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              color: value
                            },
                            hasCustomColor: true
                          }
                        : previous
                    );
                  }}
                />
                <button
                  type="button"
                  className="mt-1 text-[11px] text-slate-300 underline decoration-slate-500 hover:text-slate-100"
                  onClick={() =>
                    setTokenModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              color: defaultTokenColor(previous.draft.kind)
                            },
                            hasCustomColor: false
                          }
                        : previous
                    )
                  }
                >
                  Use faction default color
                </button>
              </label>

              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Elevation
                <input
                  type="number"
                  min={0}
                  max={999}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                  value={tokenModal.draft.elevation}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setTokenModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              elevation: Number.isFinite(value) ? clamp(value, 0, 999) : 0
                            }
                          }
                        : previous
                    );
                  }}
                />
              </label>
            </div>

            <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
              {tokenModal.mode === 'CREATE'
                ? 'Token Image (optional)'
                : 'Replace Token Image (optional)'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-1 block w-full text-xs text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-slate-600"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setTokenModal((previous) =>
                    previous
                      ? {
                          ...previous,
                          imageFile: file
                        }
                      : previous
                  );
                }}
              />
            </label>

            <div className="mt-3 rounded border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Image Framing</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Keeps image aspect ratio. Adjust offset/scale/rotation to crop inside the token.
              </p>

              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                  {tokenPreviewUrl ? (
                    <img
                      src={tokenPreviewUrl}
                      alt="Token preview"
                      className="absolute left-1/2 top-1/2 max-w-none select-none"
                      style={{
                        width: `${tokenPreviewFrame?.width ?? TOKEN_PREVIEW_DIAMETER}px`,
                        height: `${tokenPreviewFrame?.height ?? TOKEN_PREVIEW_DIAMETER}px`,
                        transform: `translate(-50%, -50%) translate(${tokenPreviewFrame?.offsetX ?? 0}px, ${tokenPreviewFrame?.offsetY ?? 0}px) rotate(${tokenPreviewFrame?.rotationDeg ?? 0}deg)`,
                        transformOrigin: 'center center'
                      }}
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        backgroundColor:
                          tokenModal.draft.color ?? defaultTokenColor(tokenModal.draft.kind)
                      }}
                    />
                  )}
                </div>

                <button
                  type="button"
                  className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                  onClick={() =>
                    setTokenModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              imageOffsetX: 0,
                              imageOffsetY: 0,
                              imageScale: 1,
                              imageRotationDeg: 0
                            }
                          }
                        : previous
                    )
                  }
                >
                  Reset framing
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[11px] uppercase tracking-wide text-slate-400">
                  Offset X
                  <input
                    type="number"
                    min={-500}
                    max={500}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                    value={Math.round(tokenModal.draft.imageOffsetX)}
                    onChange={(event) =>
                      setTokenModal((previous) =>
                        previous
                          ? {
                              ...previous,
                              draft: {
                                ...previous.draft,
                                imageOffsetX: clamp(
                                  Number.parseFloat(event.target.value),
                                  -500,
                                  500
                                )
                              }
                            }
                          : previous
                      )
                    }
                  />
                </label>

                <label className="text-[11px] uppercase tracking-wide text-slate-400">
                  Offset Y
                  <input
                    type="number"
                    min={-500}
                    max={500}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                    value={Math.round(tokenModal.draft.imageOffsetY)}
                    onChange={(event) =>
                      setTokenModal((previous) =>
                        previous
                          ? {
                              ...previous,
                              draft: {
                                ...previous.draft,
                                imageOffsetY: clamp(
                                  Number.parseFloat(event.target.value),
                                  -500,
                                  500
                                )
                              }
                            }
                          : previous
                      )
                    }
                  />
                </label>

                <label className="text-[11px] uppercase tracking-wide text-slate-400">
                  Scale
                  <input
                    type="number"
                    step={0.05}
                    min={0.1}
                    max={6}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                    value={tokenModal.draft.imageScale}
                    onChange={(event) =>
                      setTokenModal((previous) =>
                        previous
                          ? {
                              ...previous,
                              draft: {
                                ...previous.draft,
                                imageScale: clamp(Number.parseFloat(event.target.value), 0.1, 6)
                              }
                            }
                          : previous
                      )
                    }
                  />
                </label>

                <label className="text-[11px] uppercase tracking-wide text-slate-400">
                  Rotation
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                    value={tokenModal.draft.imageRotationDeg}
                    onChange={(event) =>
                      setTokenModal((previous) =>
                        previous
                          ? {
                              ...previous,
                              draft: {
                                ...previous.draft,
                                imageRotationDeg: clamp(
                                  Number.parseFloat(event.target.value),
                                  -180,
                                  180
                                )
                              }
                            }
                          : previous
                      )
                    }
                  />
                </label>
              </div>
            </div>

            {tokenFormError ? <p className="mt-3 text-xs text-rose-300">{tokenFormError}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50"
                onClick={() => {
                  void submitTokenModal();
                }}
                disabled={
                  isSubmittingToken ||
                  tokenModal.draft.name.trim().length === 0 ||
                  (tokenModal.mode === 'CREATE'
                    ? !canCreateToken
                    : !tokenModal.tokenId ||
                      !tokens.some(
                        (token) => token.id === tokenModal.tokenId && canEditToken(token)
                      ))
                }
              >
                {isSubmittingToken
                  ? tokenModal.mode === 'CREATE'
                    ? 'Creating...'
                    : 'Saving...'
                  : tokenModal.mode === 'CREATE'
                    ? 'Create Token'
                    : 'Save Token'}
              </button>
              <button
                type="button"
                className="flex-1 rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
                onClick={() => setTokenModal(null)}
                disabled={isSubmittingToken}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
