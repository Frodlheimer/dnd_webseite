export type GridType = 'SQUARE' | 'HEX';
export type GridUnit = 'ft' | 'm';
export type StackDisplayMode = 'EXACT' | 'FAN';

export type BoardSettings = {
  gridType: GridType;
  cellSizePx: number;
  cellDistance: number;
  cellUnit: GridUnit;
  gridOriginX: number;
  gridOriginY: number;
  gridOriginZ: number;
  snapToGrid: boolean;
  stackDisplay: StackDisplayMode;
  mapEditMode: boolean;
  mapCalibrationMode: boolean;
  mapOffsetX: number;
  mapOffsetY: number;
  mapScale: number;
  mapRotationDeg: number;
};

export type TokenDraft = {
  name: string;
  kind: 'ALLY' | 'ENEMY' | 'NEUTRAL';
  color: string | null;
  elevation: number;
  assetId?: string | null;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageRotationDeg: number;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  gridType: 'SQUARE',
  cellSizePx: 48,
  cellDistance: 5,
  cellUnit: 'ft',
  gridOriginX: 0,
  gridOriginY: 0,
  gridOriginZ: 0,
  snapToGrid: true,
  stackDisplay: 'FAN',
  mapEditMode: false,
  mapCalibrationMode: false,
  mapOffsetX: 0,
  mapOffsetY: 0,
  mapScale: 1,
  mapRotationDeg: 0
};

export const sanitizeBoardSettings = (candidate: Partial<BoardSettings>): BoardSettings => {
  return {
    gridType: candidate.gridType === 'HEX' ? 'HEX' : 'SQUARE',
    cellSizePx: clamp(Math.round(candidate.cellSizePx ?? DEFAULT_BOARD_SETTINGS.cellSizePx), 24, 160),
    cellDistance: clamp(Number(candidate.cellDistance ?? DEFAULT_BOARD_SETTINGS.cellDistance), 0.5, 200),
    cellUnit: candidate.cellUnit === 'm' ? 'm' : 'ft',
    gridOriginX: Number.isFinite(candidate.gridOriginX) ? Math.round(Number(candidate.gridOriginX)) : 0,
    gridOriginY: Number.isFinite(candidate.gridOriginY) ? Math.round(Number(candidate.gridOriginY)) : 0,
    gridOriginZ: Number.isFinite(candidate.gridOriginZ) ? Math.round(Number(candidate.gridOriginZ)) : 0,
    snapToGrid: candidate.snapToGrid ?? DEFAULT_BOARD_SETTINGS.snapToGrid,
    stackDisplay: candidate.stackDisplay === 'EXACT' ? 'EXACT' : 'FAN',
    mapEditMode: candidate.mapEditMode ?? DEFAULT_BOARD_SETTINGS.mapEditMode,
    mapCalibrationMode: candidate.mapCalibrationMode ?? DEFAULT_BOARD_SETTINGS.mapCalibrationMode,
    mapOffsetX: Number.isFinite(candidate.mapOffsetX) ? Number(candidate.mapOffsetX) : DEFAULT_BOARD_SETTINGS.mapOffsetX,
    mapOffsetY: Number.isFinite(candidate.mapOffsetY) ? Number(candidate.mapOffsetY) : DEFAULT_BOARD_SETTINGS.mapOffsetY,
    mapScale: clamp(Number(candidate.mapScale ?? DEFAULT_BOARD_SETTINGS.mapScale), 0.1, 6),
    mapRotationDeg: clamp(Number(candidate.mapRotationDeg ?? DEFAULT_BOARD_SETTINGS.mapRotationDeg), -180, 180)
  };
};
