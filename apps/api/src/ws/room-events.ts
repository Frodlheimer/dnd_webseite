import { EventEmitter } from 'node:events';

import type { RoomAsset } from '@dnd-vtt/shared';

type RoomMapUpdatedEvent = {
  roomId: string;
  currentMapAssetId: string | null;
  currentMapAsset: RoomAsset | null;
};

type RoomAssetCreatedEvent = {
  roomId: string;
  asset: RoomAsset;
};

type RoomEvents = {
  'room-map-updated': RoomMapUpdatedEvent;
  'room-asset-created': RoomAssetCreatedEvent;
};

const roomEventBus = new EventEmitter();

const on = <K extends keyof RoomEvents>(
  event: K,
  handler: (payload: RoomEvents[K]) => void
): (() => void) => {
  roomEventBus.on(event, handler as (...args: unknown[]) => void);

  return () => {
    roomEventBus.off(event, handler as (...args: unknown[]) => void);
  };
};

const emit = <K extends keyof RoomEvents>(event: K, payload: RoomEvents[K]): void => {
  roomEventBus.emit(event, payload);
};

export const onRoomMapUpdated = (handler: (payload: RoomMapUpdatedEvent) => void): (() => void) => {
  return on('room-map-updated', handler);
};

export const onRoomAssetCreated = (handler: (payload: RoomAssetCreatedEvent) => void): (() => void) => {
  return on('room-asset-created', handler);
};

export const emitRoomMapUpdated = (payload: RoomMapUpdatedEvent): void => {
  emit('room-map-updated', payload);
};

export const emitRoomAssetCreated = (payload: RoomAssetCreatedEvent): void => {
  emit('room-asset-created', payload);
};
